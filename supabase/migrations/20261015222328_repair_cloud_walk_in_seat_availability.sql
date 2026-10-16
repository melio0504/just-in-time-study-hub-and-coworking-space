-- Reassert the customer-facing availability implementation after the local to
-- hosted migration. The admin floor plan reads active walk-ins directly, while
-- /reserve calls this function; both paths must treat an active walk-in as
-- occupying the seat for today's availability window.
create or replace function private.get_available_seats(
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns setof public.seats
language sql
stable
security definer
set search_path = ''
as $$
  select s.*
  from public.seats s
  where s.is_active
    and s.status <> 'maintenance'
    and p_ends_at > p_starts_at
    and not exists (
      select 1
      from public.booking_seats bs
      join public.bookings b on b.id = bs.booking_id
      where bs.seat_id = s.id
        and bs.active
        and not (
          b.status = 'pending'
          and b.payment_status = 'pending'
          and b.hold_expires_at <= now()
        )
        and bs.reserved_during && tstzrange(p_starts_at, p_ends_at, '[)')
    )
    and not (
      (p_starts_at at time zone 'Asia/Manila')::date
        = (now() at time zone 'Asia/Manila')::date
      and exists (
        select 1
        from public.walk_in_occupancies occupancy
        where occupancy.seat_id = s.id
          and occupancy.ended_at is null
      )
    )
  order by s.code;
$$;

comment on function private.get_available_seats(timestamptz, timestamptz) is
  'Returns seats available for a booking window, excluding overlapping reservations and active walk-ins for the current Manila date.';
