-- Seeded reservations have no person available to scan out at the kiosk.
-- Complete only expired JIT-DEMO sessions automatically; real reservations
-- keep the normal manual checkout and overtime-resolution workflow.
create or replace function private.auto_checkout_expired_demo_bookings()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_booking_id uuid;
  v_booking public.bookings%rowtype;
  v_session public.check_in_sessions%rowtype;
  v_checkout_at timestamptz;
  v_checked_out integer := 0;
begin
  for v_booking_id in
    select booking.id
    from public.bookings as booking
    join public.check_in_sessions as session on session.booking_id = booking.id
    where booking.reservation_code like 'JIT-DEMO-%'
      and booking.status = 'checked_in'
      and booking.ends_at <= now()
      and session.status in ('checked_in', 'overtime')
      and session.checked_out_at is null
      and session.scheduled_end_at <= now()
    order by booking.id
  loop
    -- Match kiosk checkout lock order: pass, booking, seats, then session.
    perform pass.id
    from public.qr_access_passes as pass
    where pass.booking_id = v_booking_id
    for update;

    select booking.*
    into v_booking
    from public.bookings as booking
    where booking.id = v_booking_id
      and booking.reservation_code like 'JIT-DEMO-%'
      and booking.status = 'checked_in'
      and booking.ends_at <= now()
    for update;

    if not found then
      continue;
    end if;

    perform seat.id
    from public.seats as seat
    join public.booking_seats as booking_seat on booking_seat.seat_id = seat.id
    where booking_seat.booking_id = v_booking_id
    order by seat.id
    for update of seat;

    select session.*
    into v_session
    from public.check_in_sessions as session
    where session.booking_id = v_booking_id
      and session.status in ('checked_in', 'overtime')
      and session.checked_out_at is null
      and session.scheduled_end_at <= now()
    for update;

    if not found then
      continue;
    end if;

    v_checkout_at := v_session.scheduled_end_at;

    update public.check_in_sessions as session
    set
      status = 'checked_out',
      checked_out_at = v_checkout_at,
      overtime_minutes = 0,
      overtime_charge_cents = 0,
      overtime_resolution = null,
      overtime_resolved_at = null,
      overtime_resolved_by = null
    where session.id = v_session.id;

    update public.bookings as booking
    set status = 'completed'
    where booking.id = v_booking_id;

    update public.booking_seats as booking_seat
    set active = false
    where booking_seat.booking_id = v_booking_id;

    update public.seats as seat
    set status = 'available'
    from public.booking_seats as released_seat
    where released_seat.booking_id = v_booking_id
      and released_seat.seat_id = seat.id
      and seat.status <> 'maintenance'
      and not exists (
        select 1
        from public.walk_in_occupancies as occupancy
        where occupancy.seat_id = seat.id
          and occupancy.ended_at is null
      )
      and not exists (
        select 1
        from public.booking_seats as active_seat
        join public.bookings as active_booking on active_booking.id = active_seat.booking_id
        where active_seat.seat_id = seat.id
          and active_seat.booking_id <> v_booking_id
          and active_seat.active
          and active_booking.status = 'checked_in'
      );

    update public.qr_access_passes as pass
    set revoked_at = coalesce(pass.revoked_at, v_checkout_at)
    where pass.booking_id = v_booking_id;

    insert into public.audit_logs (
      actor_id,
      action,
      entity_type,
      entity_id,
      details
    ) values (
      null,
      'Demo reservation checked out automatically',
      'booking',
      v_booking_id::text,
      jsonb_build_object(
        'source', 'automation',
        'reservation_code', v_booking.reservation_code,
        'scheduled_end', v_session.scheduled_end_at,
        'checked_out_at', v_checkout_at,
        'released_seats', v_booking.seat_ids
      )
    );

    v_checked_out := v_checked_out + 1;
  end loop;

  return v_checked_out;
end;
$$;

comment on function private.auto_checkout_expired_demo_bookings() is
  'Checks out expired JIT-DEMO reservations at their scheduled end while leaving real reservations on the manual checkout workflow.';

revoke all on function private.auto_checkout_expired_demo_bookings()
from public, anon, authenticated, service_role;

create or replace function private.run_reservation_time_automation()
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform private.auto_checkout_expired_demo_bookings();
  perform private.refresh_active_overtime_sessions();
  perform private.invoke_end_time_reminder_function();
end;
$$;

revoke all on function private.run_reservation_time_automation()
from public, anon, authenticated, service_role;

-- Repair any stale seeded sessions as soon as this migration is applied.
select private.auto_checkout_expired_demo_bookings();
