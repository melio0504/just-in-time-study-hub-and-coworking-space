set lock_timeout = '5s';

alter table public.booking_settings
  drop constraint booking_settings_max_seats_per_booking_check;

alter table public.booking_settings
  add constraint booking_settings_max_seats_per_booking_check
  check (max_seats_per_booking between 1 and 49);

alter table public.bookings
  drop constraint bookings_seat_ids_check;

alter table public.bookings
  add constraint bookings_seat_ids_check
  check (cardinality(seat_ids) between 1 and 49);

create or replace function private.create_booking(
  p_guest_name text,
  p_guest_email text,
  p_booking_date date,
  p_start_time time without time zone,
  p_duration_hours smallint,
  p_space text,
  p_seat_codes text[]
) returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_booking public.bookings;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_code text;
  v_seat_count integer;
  v_max_seats smallint;
  v_rate_price_cents bigint;
  v_subtotal bigint;
  v_pricing_date date := (now() at time zone 'Asia/Manila')::date;
  v_duration_minutes integer := p_duration_hours::integer * 60;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = v_user_id and is_active) then
    raise exception 'Active profile required' using errcode = '42501';
  end if;
  if p_guest_name is null or char_length(btrim(p_guest_name)) not between 1 and 120 then
    raise exception 'Invalid guest name' using errcode = '22023';
  end if;
  if p_guest_email is null or p_guest_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Invalid guest email' using errcode = '22023';
  end if;
  if p_duration_hours not between 1 and 24 then
    raise exception 'Duration must be between 1 and 24 hours' using errcode = '22023';
  end if;

  select settings.max_seats_per_booking
  into strict v_max_seats
  from public.booking_settings as settings
  where settings.singleton;

  if coalesce(cardinality(p_seat_codes), 0) not between 1 and v_max_seats
     or cardinality(p_seat_codes) <> (select count(distinct value) from unnest(p_seat_codes) as value) then
    raise exception 'Choose between 1 and % unique seats', v_max_seats using errcode = '22023';
  end if;

  v_starts_at := (p_booking_date::timestamp + p_start_time) at time zone 'Asia/Manila';
  v_ends_at := v_starts_at + make_interval(hours => p_duration_hours);
  if v_starts_at <= now() then
    raise exception 'Reservation must start in the future' using errcode = '22023';
  end if;

  for v_code in select value from unnest(p_seat_codes) as value order by value loop
    perform pg_advisory_xact_lock(hashtextextended('jit-seat:' || v_code, 0));
  end loop;

  update public.bookings
  set status = 'cancelled', cancelled_at = now(), cancellation_reason = 'Payment hold expired'
  where status = 'pending' and hold_expires_at <= now();

  select count(*)
  into v_seat_count
  from public.seats
  where code = any(p_seat_codes) and is_active and status <> 'maintenance';

  if v_seat_count <> cardinality(p_seat_codes) then
    raise exception 'One or more seats are unavailable' using errcode = 'P0001';
  end if;

  select rate.price_cents
  into v_rate_price_cents
  from public.service_rate_plans as rate
  where rate.is_active
    and rate.effective_from <= v_pricing_date
    and (rate.effective_until is null or rate.effective_until >= v_pricing_date)
    and rate.min_minutes <= v_duration_minutes
    and (rate.max_minutes is null or rate.max_minutes >= v_duration_minutes)
  order by rate.sort_order, rate.min_minutes, rate.id
  limit 1;

  if not found then
    raise exception 'No active reservation rate covers this duration' using errcode = 'P0001';
  end if;

  v_subtotal := v_rate_price_cents * v_seat_count;

  insert into public.bookings (
    reservation_code, user_id, guest_name, guest_email, booking_date, start_time,
    starts_at, ends_at, duration_hours, space, seat_ids, subtotal_cents, hold_expires_at
  ) values (
    private.generate_reservation_code(), v_user_id, btrim(p_guest_name), lower(p_guest_email),
    p_booking_date, p_start_time, v_starts_at, v_ends_at, p_duration_hours,
    coalesce(nullif(btrim(p_space), ''), 'study-seat'), p_seat_codes,
    v_subtotal, now() + interval '15 minutes'
  ) returning * into v_booking;

  begin
    insert into public.booking_seats (booking_id, seat_id, reserved_during)
    select v_booking.id, id, tstzrange(v_starts_at, v_ends_at, '[)')
    from public.seats where code = any(p_seat_codes);
  exception when exclusion_violation then
    raise exception 'One or more seats were just reserved for that time' using errcode = '23P01';
  end;

  return v_booking;
end;
$$;

comment on column public.booking_settings.max_seats_per_booking is
  'Maximum seats a customer may include in one reservation, capped by the 49-seat floor plan.';
