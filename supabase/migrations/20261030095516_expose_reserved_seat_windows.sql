-- Expose only the schedule needed to explain why a seat is unavailable.
-- Customer, booking, payment, and contact details remain private.
create function private.get_reserved_seat_windows(
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns table (
  seat_code text,
  starts_at timestamptz,
  ends_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    seat.code::text as seat_code,
    lower(booking_seat.reserved_during) as starts_at,
    upper(booking_seat.reserved_during) as ends_at
  from public.booking_seats as booking_seat
  join public.bookings as booking on booking.id = booking_seat.booking_id
  join public.seats as seat on seat.id = booking_seat.seat_id
  where booking_seat.active
    and p_ends_at > p_starts_at
    and not (
      booking.status = 'pending'
      and booking.payment_status = 'pending'
      and booking.hold_expires_at <= now()
    )
    and booking_seat.reserved_during && tstzrange(p_starts_at, p_ends_at, '[)')
  order by seat.code, lower(booking_seat.reserved_during);
$$;

create function public.get_reserved_seat_windows(
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns table (
  seat_code text,
  starts_at timestamptz,
  ends_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from private.get_reserved_seat_windows(p_starts_at, p_ends_at);
$$;

revoke execute on function private.get_reserved_seat_windows(timestamptz, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.get_reserved_seat_windows(timestamptz, timestamptz)
  from public, anon, authenticated;

grant execute on function private.get_reserved_seat_windows(timestamptz, timestamptz)
  to anon, authenticated;
grant execute on function public.get_reserved_seat_windows(timestamptz, timestamptz)
  to anon, authenticated;

comment on function public.get_reserved_seat_windows(timestamptz, timestamptz) is
  'Returns only seat codes and reserved time windows for the requested interval; no customer or booking details are exposed.';
