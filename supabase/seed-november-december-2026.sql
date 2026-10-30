-- One-off, idempotent hosted-data seed for November and December 2026.
--
-- This file is intentionally NOT listed in supabase/config.toml and is not a
-- migration. Apply it explicitly to the intended hosted project only. It adds
-- customer accounts and confirmed reservations, but never updates or deletes
-- an existing Auth user, profile, booking, staff account, or administrator.

begin;

-- The application trigger normally rejects historical or far-future fixtures.
-- Keep the bypass scoped to this transaction only.
select set_config('jit.seed_mode', 'on', true);

-- Prove at the end of the transaction that staff and administrator rows stayed
-- byte-for-byte equivalent at the JSON value level.
create temporary table jit_staff_snapshot on commit drop as
select profile.id, to_jsonb(profile) as row_data
from public.profiles as profile
where profile.role in ('staff', 'admin');

create temporary table jit_dummy_customers on commit drop as
with name_pool as (
  select
    array[
      'Aira', 'Benjie', 'Celine', 'Dario', 'Elise',
      'Franco', 'Giselle', 'Harvey', 'Ina', 'Jomar'
    ]::text[] as first_names,
    array[
      'Aguilar', 'Bacani', 'Cordero', 'Dimaculangan',
      'Evangelista', 'Fajardo', 'Guerrero', 'Hilario'
    ]::text[] as last_names
)
select
  customer_number,
  md5('jit-novdec-2026-customer:' || customer_number::text)::uuid as id,
  name_pool.first_names[((customer_number - 1) % 10) + 1]
    || ' '
    || name_pool.last_names[((customer_number - 1) / 10) + 1] as full_name,
  'dummy.novdec2026.' || lpad(customer_number::text, 3, '0')
    || '@example.com' as email,
  '+63950' || lpad(customer_number::text, 7, '0') as phone,
  ('2026-10-20 08:00:00+08'::timestamptz
    + make_interval(mins => customer_number)) as created_at
from generate_series(1, 80) as customer(customer_number)
cross join name_pool;

-- Stop instead of touching an existing account when a deterministic seed ID
-- or email is already associated with some other user.
do $$
begin
  if exists (
    select 1
    from jit_dummy_customers as seed
    join auth.users as auth_user
      on auth_user.id = seed.id
      or lower(auth_user.email) = lower(seed.email)
    where auth_user.id <> seed.id
       or lower(auth_user.email) <> lower(seed.email)
  ) then
    raise exception 'A November/December dummy customer ID or email conflicts with an existing Auth user';
  end if;

  if exists (
    select 1
    from jit_dummy_customers as seed
    join public.profiles as profile on profile.id = seed.id
    where profile.role <> 'customer'
  ) then
    raise exception 'A November/December dummy customer ID belongs to a staff or administrator profile';
  end if;
end
$$;

-- Passwords are random and intentionally not retained. These are display/demo
-- customers, not shared test-login accounts.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  email_change_token_current,
  reauthentication_token,
  is_sso_user,
  is_anonymous
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  customer.id,
  'authenticated',
  'authenticated',
  customer.email,
  extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
  customer.created_at,
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object(
    'sub', customer.id::text,
    'email', customer.email,
    'full_name', customer.full_name,
    'phone', customer.phone,
    'email_verified', true,
    'phone_verified', false,
    'dummy_data_set', 'november-december-2026'
  ),
  false,
  customer.created_at,
  customer.created_at,
  '',
  '',
  '',
  '',
  '',
  '',
  false,
  false
from jit_dummy_customers as customer
on conflict (id) do nothing;

insert into auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  customer.id::text,
  customer.id,
  jsonb_build_object(
    'sub', customer.id::text,
    'email', customer.email,
    'full_name', customer.full_name,
    'email_verified', true,
    'phone_verified', false,
    'dummy_data_set', 'november-december-2026'
  ),
  'email',
  customer.created_at,
  customer.created_at,
  customer.created_at
from jit_dummy_customers as customer
on conflict (provider_id, provider) do nothing;

do $$
begin
  if (
    select count(*)
    from jit_dummy_customers as seed
    join public.profiles as profile on profile.id = seed.id
    where profile.role = 'customer'
      and lower(profile.email) = lower(seed.email)
  ) <> 80 then
    raise exception 'Expected 80 customer profiles after creating the dummy Auth users';
  end if;
end
$$;

-- Four non-overlapping reservations per day provide visible availability at
-- morning, afternoon, evening, and late-night times throughout both months.
create temporary table jit_dummy_booking_requests on commit drop as
with numbered_requests as (
  select
    row_number() over (order by booking_date, slot.slot_number)::integer as booking_number,
    calendar.booking_date::date as booking_date,
    slot.slot_number,
    slot.start_time,
    slot.duration_hours
  from generate_series('2026-11-01'::date, '2026-12-31'::date, interval '1 day')
    as calendar(booking_date)
  cross join (values
    (1, '09:00:00'::time, 3::smallint),
    (2, '13:00:00'::time, 3::smallint),
    (3, '17:00:00'::time, 3::smallint),
    (4, '21:00:00'::time, 4::smallint)
  ) as slot(slot_number, start_time, duration_hours)
)
select
  request.booking_number,
  request.slot_number,
  md5(
    'jit-novdec-2026-booking:'
    || request.booking_date::text
    || ':'
    || request.slot_number::text
  )::uuid as id,
  'JIT-DEMO-ND26-'
    || to_char(request.booking_date, 'MMDD')
    || '-'
    || request.slot_number::text as reservation_code,
  md5(
    'jit-novdec-2026-customer:'
    || (((request.booking_number - 1) % 80) + 1)::text
  )::uuid as user_id,
  request.booking_date,
  request.start_time,
  ((request.booking_date + request.start_time) at time zone 'Asia/Manila') as starts_at,
  ((request.booking_date + request.start_time) at time zone 'Asia/Manila')
    + make_interval(hours => request.duration_hours) as ends_at,
  request.duration_hours,
  ('2026-10-22 08:00:00+08'::timestamptz
    + make_interval(mins => request.booking_number * 3)) as created_at
from numbered_requests as request;

do $$
begin
  if (
    select count(*) from jit_dummy_booking_requests
  ) <> 244 then
    raise exception 'Expected 244 November/December booking requests';
  end if;

  if exists (
    select 1
    from jit_dummy_booking_requests as seed
    join public.bookings as booking
      on booking.id = seed.id
      or booking.reservation_code = seed.reservation_code
    where booking.id <> seed.id
       or booking.reservation_code <> seed.reservation_code
  ) then
    raise exception 'A November/December dummy reservation ID or code conflicts with an existing booking';
  end if;
end
$$;

-- Pick two seats deterministically for each time slot while respecting all
-- existing active reservations. On a rerun, the request's own existing seats
-- are excluded from the collision test, so it selects the same pair again.
create temporary table jit_dummy_booking_plan on commit drop as
select
  request.*,
  selected_seats.seat_ids,
  selected_seats.subtotal_cents
from jit_dummy_booking_requests as request
cross join lateral (
  select
    array_agg(candidate.code order by candidate.code) as seat_ids,
    sum(candidate.hourly_rate_cents * request.duration_hours)::bigint as subtotal_cents
  from (
    select seat.code, seat.hourly_rate_cents
    from public.seats as seat
    where seat.is_active
      and seat.status <> 'maintenance'
      and not exists (
        select 1
        from public.booking_seats as booking_seat
        where booking_seat.seat_id = seat.id
          and booking_seat.active
          and booking_seat.booking_id <> request.id
          and booking_seat.reserved_during
            && tstzrange(request.starts_at, request.ends_at, '[)')
      )
    order by md5(
      request.booking_date::text
      || ':'
      || request.slot_number::text
      || ':'
      || seat.code
    )
    limit 2
  ) as candidate
) as selected_seats;

do $$
begin
  if exists (
    select 1
    from jit_dummy_booking_plan
    where cardinality(seat_ids) <> 2
       or subtotal_cents is null
       or subtotal_cents <= 0
  ) then
    raise exception 'At least one November/December time slot has fewer than two available seats';
  end if;

  -- Existing rows from an earlier run must still match the deterministic plan.
  -- Refuse to overwrite manual changes.
  if exists (
    select 1
    from jit_dummy_booking_plan as seed
    join public.bookings as booking on booking.id = seed.id
    where booking.reservation_code <> seed.reservation_code
       or booking.user_id <> seed.user_id
       or booking.starts_at <> seed.starts_at
       or booking.ends_at <> seed.ends_at
       or booking.seat_ids <> seed.seat_ids
  ) then
    raise exception 'An existing November/December dummy reservation was manually changed; no data was written';
  end if;
end
$$;

insert into public.bookings (
  id,
  reservation_code,
  user_id,
  guest_name,
  guest_email,
  booking_date,
  start_time,
  starts_at,
  ends_at,
  duration_hours,
  space,
  seat_ids,
  status,
  payment_status,
  subtotal_cents,
  hold_expires_at,
  confirmation_email_sent_at,
  created_at,
  updated_at
)
select
  plan.id,
  plan.reservation_code,
  customer.id,
  customer.full_name,
  customer.email,
  plan.booking_date,
  plan.start_time,
  plan.starts_at,
  plan.ends_at,
  plan.duration_hours,
  'study-seat',
  plan.seat_ids,
  'confirmed'::public.booking_status,
  'not_required'::public.payment_status,
  plan.subtotal_cents,
  null,
  plan.created_at + interval '5 minutes',
  plan.created_at,
  plan.created_at + interval '5 minutes'
from jit_dummy_booking_plan as plan
join jit_dummy_customers as customer on customer.id = plan.user_id
on conflict (id) do nothing;

insert into public.booking_seats (
  booking_id,
  seat_id,
  reserved_during,
  active,
  created_at
)
select
  plan.id,
  seat.id,
  tstzrange(plan.starts_at, plan.ends_at, '[)'),
  true,
  plan.created_at
from jit_dummy_booking_plan as plan
cross join lateral unnest(plan.seat_ids) as selected_seat(code)
join public.seats as seat on seat.code = selected_seat.code
on conflict (booking_id, seat_id) do nothing;

-- Validate the complete data set and the explicit promise not to touch staff.
do $$
begin
  if (
    select count(*)
    from public.bookings
    where reservation_code like 'JIT-DEMO-ND26-%'
  ) <> 244 then
    raise exception 'Expected 244 November/December dummy reservations after insertion';
  end if;

  if exists (
    select calendar.booking_date::date
    from generate_series('2026-11-01'::date, '2026-12-31'::date, interval '1 day')
      as calendar(booking_date)
    left join public.bookings as booking
      on booking.booking_date = calendar.booking_date::date
      and booking.reservation_code like 'JIT-DEMO-ND26-%'
      and booking.status = 'confirmed'
    group by calendar.booking_date::date
    having count(booking.id) <> 4
       or coalesce(sum(cardinality(booking.seat_ids)), 0) <> 8
  ) then
    raise exception 'Every November/December date must have four confirmed reservations and eight reserved seats';
  end if;

  if exists (
    select 1
    from jit_dummy_booking_plan as plan
    where (
      select count(*)
      from public.booking_seats as booking_seat
      where booking_seat.booking_id = plan.id
        and booking_seat.active
    ) <> cardinality(plan.seat_ids)
  ) then
    raise exception 'A dummy reservation is missing one or more active booking-seat rows';
  end if;

  if exists (
    select snapshot.id
    from jit_staff_snapshot as snapshot
    full join (
      select * from public.profiles where role in ('staff', 'admin')
    ) as profile on profile.id = snapshot.id
    where snapshot.row_data is distinct from to_jsonb(profile)
  ) then
    raise exception 'A staff or administrator profile changed; rolling back the complete seed';
  end if;

  if (
    select count(*)
    from public.profiles
    where role in ('staff', 'admin')
  ) <> (
    select count(*) from jit_staff_snapshot
  ) then
    raise exception 'The staff/administrator account count changed; rolling back the complete seed';
  end if;
end
$$;

commit;

select
  count(distinct booking.user_id) as dummy_customers_with_reservations,
  count(*) as reservations,
  min(booking.booking_date) as first_reservation_date,
  max(booking.booking_date) as last_reservation_date,
  sum(cardinality(booking.seat_ids)) as reserved_seat_slots
from public.bookings as booking
where booking.reservation_code like 'JIT-DEMO-ND26-%';
