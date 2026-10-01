create or replace function private.get_available_seats(p_starts_at timestamptz, p_ends_at timestamptz)
returns setof public.seats language sql stable security definer set search_path = '' as $$
  select s.* from public.seats as s
  where s.is_active and s.status <> 'maintenance' and p_ends_at > p_starts_at
    and not exists (
      select 1 from public.booking_seats as bs
      where bs.seat_id = s.id and bs.active
        and bs.reserved_during && tstzrange(p_starts_at, p_ends_at, '[)')
    )
    and not (
      (p_starts_at at time zone 'Asia/Manila')::date = (now() at time zone 'Asia/Manila')::date
      and exists (
        select 1 from public.walk_in_occupancies as occupancy
        where occupancy.seat_id = s.id and occupancy.ended_at is null
      )
    )
  order by s.code;
$$;

create function private.prevent_current_walk_in_booking() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (lower(new.reserved_during) at time zone 'Asia/Manila')::date = (now() at time zone 'Asia/Manila')::date
     and exists (
       select 1 from public.walk_in_occupancies
       where seat_id = new.seat_id and ended_at is null
     ) then
    raise exception 'Seat is currently occupied by a walk-in' using errcode = '23P01';
  end if;
  return new;
end;
$$;

create trigger booking_seats_prevent_current_walk_in
before insert or update of seat_id, reserved_during, active on public.booking_seats
for each row when (new.active)
execute function private.prevent_current_walk_in_booking();

revoke execute on function private.prevent_current_walk_in_booking() from public, anon, authenticated, service_role;
