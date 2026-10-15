create extension if not exists pg_cron with schema pg_catalog;

alter table public.booking_settings
  add column no_show_grace_minutes integer not null default 30;

alter table public.booking_settings
  add constraint booking_settings_no_show_grace_minutes_check
  check (no_show_grace_minutes between 5 and 240);

create or replace function private.mark_overdue_bookings_no_show()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_grace_minutes integer;
  v_marked integer;
begin
  select settings.no_show_grace_minutes
  into strict v_grace_minutes
  from public.booking_settings as settings
  where settings.singleton;

  with marked as (
    update public.bookings as booking
    set status = 'no_show'
    where booking.status = 'confirmed'
      and booking.starts_at <= now() - make_interval(mins => v_grace_minutes)
    returning
      booking.id,
      booking.reservation_code,
      booking.seat_ids,
      booking.starts_at,
      booking.payment_status
  ), revoked_passes as (
    update public.qr_access_passes as pass
    set revoked_at = coalesce(pass.revoked_at, now())
    from marked
    where pass.booking_id = marked.id
      and pass.revoked_at is null
    returning pass.id
  ), logged as (
    insert into public.audit_logs (
      actor_id,
      action,
      entity_type,
      entity_id,
      details
    )
    select
      null,
      'Reservation marked no-show',
      'booking',
      marked.id::text,
      jsonb_build_object(
        'source', 'automation',
        'reservation_code', marked.reservation_code,
        'scheduled_start', marked.starts_at,
        'grace_minutes', v_grace_minutes,
        'released_seats', marked.seat_ids,
        'payment_status', marked.payment_status
      )
    from marked
    returning id
  )
  select count(*)::integer into v_marked
  from marked;

  return v_marked;
end;
$$;

comment on function private.mark_overdue_bookings_no_show() is
  'Marks confirmed reservations as no-shows after the configured grace period, releases their seats, revokes QR passes, and writes audit logs.';

revoke all on function private.mark_overdue_bookings_no_show()
from public, anon, authenticated, service_role;

select cron.schedule(
  'mark-overdue-reservations-no-show',
  '* * * * *',
  'select private.mark_overdue_bookings_no_show();'
);

create or replace function private.start_walk_in(
  p_seat_code text,
  p_guest_name text default null,
  p_notes text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_seat_id uuid;
  v_walk_in_id uuid;
  v_started_at timestamptz := now();
begin
  if v_actor is null or not private.has_staff_permission('seating') then
    raise exception 'Seating access required' using errcode = '42501';
  end if;

  select id into v_seat_id
  from public.seats
  where code = upper(btrim(p_seat_code)) and is_active and status <> 'maintenance'
  for update;

  if v_seat_id is null then
    raise exception 'Seat not found or unavailable' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.walk_in_occupancies
    where seat_id = v_seat_id and ended_at is null
  ) then
    raise exception 'This seat already has an active walk-in' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.booking_seats as booking_seat
    join public.bookings as booking on booking.id = booking_seat.booking_id
    where booking_seat.seat_id = v_seat_id
      and booking_seat.active
      and booking_seat.reserved_during @> v_started_at
      and booking.status in ('pending', 'confirmed', 'checked_in')
      and not (
        booking.status = 'pending'
        and booking.payment_status = 'pending'
        and booking.hold_expires_at <= v_started_at
      )
  ) then
    raise exception 'This seat is reserved for an active reservation' using errcode = 'P0001';
  end if;

  insert into public.walk_in_occupancies (
    seat_id, guest_name, started_at, business_date, status, payment_status,
    notes, created_by
  ) values (
    v_seat_id,
    nullif(btrim(p_guest_name), ''),
    v_started_at,
    (((v_started_at at time zone 'Asia/Manila') - interval '8 hours')::date),
    'active',
    'unpaid',
    nullif(btrim(p_notes), ''),
    v_actor
  ) returning id into v_walk_in_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (
    v_actor,
    'Walk-in checked in',
    'walk_in',
    v_walk_in_id::text,
    jsonb_build_object('seat_code', upper(btrim(p_seat_code)))
  );

  return v_walk_in_id;
end;
$$;
