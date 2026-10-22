create type public.overtime_resolution as enum ('paid_manually', 'waived');

alter table public.check_in_sessions
  add column overtime_resolution public.overtime_resolution,
  add column overtime_resolved_at timestamptz,
  add column overtime_resolved_by uuid references public.profiles (id) on delete set null,
  add constraint check_in_sessions_overtime_resolution_consistency check (
    (overtime_resolution is null and overtime_resolved_at is null)
    or (
      overtime_resolution is not null
      and overtime_resolved_at is not null
      and status = 'checked_out'
    )
  );

create index check_in_sessions_overtime_resolved_by_idx
  on public.check_in_sessions (overtime_resolved_by)
  where overtime_resolved_by is not null;

create or replace function private.resolve_overtime_session(
  p_booking_id uuid,
  p_resolution public.overtime_resolution
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_pass public.qr_access_passes%rowtype;
  v_session public.check_in_sessions%rowtype;
begin
  if v_actor is null or not (
    private.has_staff_permission('seating')
    or private.has_staff_permission('reservations')
  ) then
    raise exception 'Seating or reservation access required' using errcode = '42501';
  end if;

  if p_resolution is null then
    raise exception 'An overtime resolution is required' using errcode = '22023';
  end if;

  -- Match the kiosk checkout lock order so a scan and a manual resolution
  -- cannot deadlock each other: pass, booking, seats, then session.
  select pass.*
  into v_pass
  from public.qr_access_passes as pass
  where pass.booking_id = p_booking_id
  for update;

  select booking.*
  into v_booking
  from public.bookings as booking
  where booking.id = p_booking_id
  for update;

  if not found then
    raise exception 'Reservation not found' using errcode = 'P0002';
  end if;

  perform seat.id
  from public.seats as seat
  join public.booking_seats as booking_seat on booking_seat.seat_id = seat.id
  where booking_seat.booking_id = p_booking_id
  order by seat.id
  for update of seat;

  select session.*
  into v_session
  from public.check_in_sessions as session
  where session.booking_id = p_booking_id
    and session.status = 'overtime'
    and session.checked_out_at is null
  for update;

  if not found then
    raise exception 'No active overtime session found for this reservation'
      using errcode = 'P0001';
  end if;

  update public.check_in_sessions as session
  set
    status = 'checked_out',
    checked_out_at = now(),
    overtime_resolution = p_resolution,
    overtime_resolved_at = now(),
    overtime_resolved_by = v_actor
  where session.id = v_session.id;

  update public.bookings as booking
  set status = 'completed'
  where booking.id = p_booking_id;

  update public.booking_seats as booking_seat
  set active = false
  where booking_seat.booking_id = p_booking_id;

  update public.seats as seat
  set status = 'available'
  from public.booking_seats as booking_seat
  where booking_seat.booking_id = p_booking_id
    and booking_seat.seat_id = seat.id
    and seat.status <> 'maintenance';

  update public.qr_access_passes as pass
  set revoked_at = coalesce(pass.revoked_at, now())
  where pass.id = v_pass.id;

  insert into public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    details
  ) values (
    v_actor,
    case p_resolution
      when 'paid_manually' then 'Recorded manual overtime payment'
      else 'Removed overtime charge without payment'
    end,
    'booking',
    p_booking_id::text,
    jsonb_build_object(
      'reservation_code', v_booking.reservation_code,
      'resolution', p_resolution,
      'overtime_minutes', v_session.overtime_minutes,
      'overtime_charge_cents', v_session.overtime_charge_cents
    )
  );
end;
$$;

create or replace function public.resolve_overtime_session(
  p_booking_id uuid,
  p_resolution public.overtime_resolution
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.resolve_overtime_session(p_booking_id, p_resolution);
$$;

revoke all on function private.resolve_overtime_session(uuid, public.overtime_resolution)
  from public, anon, authenticated, service_role;
revoke all on function public.resolve_overtime_session(uuid, public.overtime_resolution)
  from public, anon, authenticated, service_role;
grant execute on function private.resolve_overtime_session(uuid, public.overtime_resolution)
  to authenticated;
grant execute on function public.resolve_overtime_session(uuid, public.overtime_resolution)
  to authenticated;

comment on function public.resolve_overtime_session(uuid, public.overtime_resolution) is
  'Closes an active overtime session as manually paid or waived, completes the reservation, releases its seats, revokes its QR pass, and records an audit log.';
