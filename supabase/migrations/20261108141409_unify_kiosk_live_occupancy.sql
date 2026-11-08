-- HC16 is no longer part of the physical facility. Remove it completely, but
-- fail safely rather than deleting booking or walk-in history if another
-- environment still has foreign-key references to the seat.
do $$
begin
  if not exists (select 1 from public.seats where code = 'HC16') then
    raise exception 'HC16 seat record was not found';
  end if;

  if exists (
    select 1
    from public.booking_seats as booking_seat
    join public.seats as seat on seat.id = booking_seat.seat_id
    where seat.code = 'HC16'
  ) or exists (
    select 1
    from public.walk_in_occupancies as occupancy
    join public.seats as seat on seat.id = occupancy.seat_id
    where seat.code = 'HC16'
  ) then
    raise exception 'HC16 cannot be deleted while booking or walk-in history references it';
  end if;

  delete from public.seats
  where code = 'HC16';
end;
$$;

-- The kiosk must represent physical occupancy, not only QR reservations that
-- are still within their scheduled time. Include overtime reservations and
-- active walk-ins in the same session-shaped response.
create or replace function private.get_kiosk_active_sessions()
returns table (
  booking_id text,
  guest_name text,
  seats text[],
  checked_in_at timestamptz,
  scheduled_end timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    active_session.booking_id,
    active_session.guest_name,
    active_session.seats,
    active_session.checked_in_at,
    active_session.scheduled_end
  from (
    select
      booking.reservation_code as booking_id,
      booking.guest_name,
      booking.seat_ids as seats,
      session.checked_in_at,
      session.scheduled_end_at as scheduled_end
    from public.check_in_sessions as session
    join public.bookings as booking on booking.id = session.booking_id
    where session.status in ('checked_in', 'overtime')
      and session.checked_out_at is null

    union all

    select
      'walk-in:' || occupancy.id::text as booking_id,
      coalesce(occupancy.guest_name, 'Walk-in guest') as guest_name,
      array[seat.code]::text[] as seats,
      occupancy.started_at as checked_in_at,
      null::timestamptz as scheduled_end
    from public.walk_in_occupancies as occupancy
    join public.seats as seat on seat.id = occupancy.seat_id
    where occupancy.ended_at is null
      and seat.is_active
  ) as active_session
  order by active_session.checked_in_at desc;
$$;

comment on function public.get_kiosk_active_sessions() is
  'Returns checked-in and overtime reservations plus active walk-ins to the device-authenticated kiosk Edge Function.';

create or replace function private.get_kiosk_active_seat_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.seats
  where is_active;
$$;

create or replace function public.get_kiosk_active_seat_count()
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_kiosk_active_seat_count();
$$;

revoke execute on function private.get_kiosk_active_seat_count()
  from public, anon, authenticated, service_role;
revoke execute on function public.get_kiosk_active_seat_count()
  from public, anon, authenticated, service_role;

grant execute on function private.get_kiosk_active_seat_count() to service_role;
grant execute on function public.get_kiosk_active_seat_count() to service_role;

comment on function public.get_kiosk_active_seat_count() is
  'Returns the active facility capacity to the device-authenticated kiosk Edge Function.';
