-- A checked-in reservation remains physically occupied until checkout, even
-- after its scheduled reservation range has elapsed. The admin floor plan
-- already uses that lifecycle state; keep customer availability in sync.
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
      and (
        exists (
          select 1
          from public.walk_in_occupancies occupancy
          where occupancy.seat_id = s.id
            and occupancy.ended_at is null
        )
        or exists (
          select 1
          from public.booking_seats checked_in_seat
          join public.bookings checked_in_booking
            on checked_in_booking.id = checked_in_seat.booking_id
          where checked_in_seat.seat_id = s.id
            and checked_in_seat.active
            and checked_in_booking.status = 'checked_in'
        )
      )
    )
  order by s.code;
$$;

create or replace function private.get_available_seats_for_booking(
  p_booking_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns setof public.seats
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_ends_at <= p_starts_at then
    raise exception 'The reservation end must be after its start' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.bookings b
    where b.id = p_booking_id and b.user_id = v_actor
  ) then
    raise exception 'Reservation not found' using errcode = 'P0002';
  end if;

  return query
  select s.*
  from public.seats s
  where s.is_active
    and s.status <> 'maintenance'
    and not exists (
      select 1
      from public.booking_seats bs
      join public.bookings b on b.id = bs.booking_id
      where bs.seat_id = s.id
        and bs.active
        and bs.booking_id <> p_booking_id
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
      and (
        exists (
          select 1
          from public.walk_in_occupancies occupancy
          where occupancy.seat_id = s.id
            and occupancy.ended_at is null
        )
        or exists (
          select 1
          from public.booking_seats checked_in_seat
          join public.bookings checked_in_booking
            on checked_in_booking.id = checked_in_seat.booking_id
          where checked_in_seat.seat_id = s.id
            and checked_in_seat.active
            and checked_in_booking.status = 'checked_in'
        )
      )
    )
  order by s.code;
end;
$$;

-- Protect the write path as well as the availability display. Excluding the
-- row's own booking lets the status-sync trigger keep its active link intact
-- when a reservation transitions to checked_in.
create or replace function private.prevent_current_walk_in_booking()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (lower(new.reserved_during) at time zone 'Asia/Manila')::date
       = (now() at time zone 'Asia/Manila')::date
     and exists (
       select 1
       from public.walk_in_occupancies
       where seat_id = new.seat_id
         and ended_at is null
     ) then
    raise exception 'Seat is currently occupied by a walk-in' using errcode = '23P01';
  end if;

  if (lower(new.reserved_during) at time zone 'Asia/Manila')::date
       = (now() at time zone 'Asia/Manila')::date
     and exists (
       select 1
       from public.booking_seats checked_in_seat
       join public.bookings checked_in_booking
         on checked_in_booking.id = checked_in_seat.booking_id
       where checked_in_seat.seat_id = new.seat_id
         and checked_in_seat.booking_id <> new.booking_id
         and checked_in_seat.active
         and checked_in_booking.status = 'checked_in'
     ) then
    raise exception 'Seat is currently occupied by a checked-in reservation' using errcode = '23P01';
  end if;

  return new;
end;
$$;

comment on function private.get_available_seats(timestamptz, timestamptz) is
  'Returns seats available for a booking window, excluding overlapping reservations and current-day live occupancy from walk-ins or checked-in bookings.';
