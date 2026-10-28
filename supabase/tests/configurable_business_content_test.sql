begin;
select plan(33);

select has_table('public', 'business_hours', 'weekly business hours table exists');
select has_table('public', 'business_closures', 'business closures table exists');
select has_table('public', 'booking_settings', 'booking settings table exists');
select has_table('public', 'package_rate_plans', 'package rate plans table exists');
select is((select count(*) from public.business_hours), 7::bigint, 'all seven weekdays are configured');
select is((select count(*) from public.booking_settings), 1::bigint, 'booking settings has one singleton row');
select is(
  (select max_duration_hours from public.booking_settings where singleton),
  24::smallint,
  'reservations can use the full operating-day window'
);
select is((select count(*) from public.package_rate_plans), 4::bigint, 'the existing package prices are migrated into configurable rows');
select has_function(
  'private',
  'update_seat_type_rate',
  array['text', 'bigint'],
  'the privileged seat-rate implementation is private'
);
select ok(
  not (select prosecdef from pg_proc where oid = 'public.update_seat_type_rate(text,bigint)'::regprocedure),
  'the exposed seat-rate RPC uses invoker privileges'
);
select ok(
  (select prosecdef from pg_proc where oid = 'private.update_seat_type_rate(text,bigint)'::regprocedure),
  'the private implementation owns the privileged operation'
);
select ok(
  not has_function_privilege('anon', 'public.update_seat_type_rate(text,bigint)', 'execute'),
  'anonymous users cannot execute the seat-rate RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.update_seat_type_rate(text,bigint)', 'execute'),
  'signed-in users can reach the staff-authorized RPC wrapper'
);
select ok(
  not has_function_privilege('service_role', 'public.update_seat_type_rate(text,bigint)', 'execute'),
  'the service role has no direct access to the exposed seat-rate RPC'
);
select ok(
  has_function_privilege('authenticated', 'private.update_seat_type_rate(text,bigint)', 'execute'),
  'the invoker wrapper can execute the private implementation'
);
select ok(
  not has_function_privilege('anon', 'private.update_seat_type_rate(text,bigint)', 'execute'),
  'anonymous users cannot execute the private implementation'
);

select set_config('test.customer_id', (
  select id::text from public.profiles where email = 'maria.santos.jit@gmail.com'
), true);
select set_config('test.content_staff_id', (
  select id::text from public.profiles where email = 'sofia.mercado@jit-studyhub.com'
), true);

insert into public.business_closures (name, starts_on, ends_on, is_active)
values ('Inactive private closure', current_date + 60, current_date + 60, false);

insert into public.seats (code, name, zone, seat_type, hourly_rate_cents)
values
  ('TC91', 'CMS test seat 1', 'Test zone', 'cms-test', 5000),
  ('TC92', 'CMS test seat 2', 'Test zone', 'cms-test', 5000),
  ('TC93', 'CMS test seat 3', 'Test zone', 'cms-test', 5000);

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select is((select count(*) from public.business_hours), 7::bigint, 'visitors can read operating hours');
select is((select count(*) from public.package_rate_plans), 4::bigint, 'visitors can read active package prices');
select ok(
  not exists (select 1 from public.business_closures where name = 'Inactive private closure'),
  'visitors cannot read inactive closures'
);
select throws_ok(
  $$ update public.business_hours set opens_at = opens_at where day_of_week = 0 $$,
  '42501',
  'permission denied for table business_hours',
  'visitors cannot edit business hours'
);

reset role;
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', current_setting('test.customer_id'), 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select is_empty(
  $$ update public.booking_settings set maximum_advance_days = 30 where singleton returning singleton $$,
  'customers cannot edit booking limits'
);
select throws_ok(
  $$ select public.update_seat_type_rate('cms-test', 6000) $$,
  '42501',
  'Content management access required',
  'customers cannot change reservation seat prices'
);

reset role;
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', current_setting('test.content_staff_id'), 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select results_eq(
  $$ update public.business_hours set opens_at = opens_at where day_of_week = 0 returning day_of_week $$,
  $$ values (0::smallint) $$,
  'content staff can edit operating hours'
);
select results_eq(
  $$
    insert into public.business_closures (name, starts_on, ends_on, closure_type, created_by)
    values ('CMS closure test', current_date + 70, current_date + 70, 'holiday', auth.uid())
    returning name
  $$,
  $$ values ('CMS closure test'::text) $$,
  'content staff can add closure dates'
);
select results_eq(
  $$
    update public.booking_settings
    set max_seats_per_booking = 2, max_duration_hours = 4
    where singleton
    returning max_seats_per_booking
  $$,
  $$ values (2::smallint) $$,
  'content staff can edit booking limits'
);
select results_eq(
  $$
    update public.service_rate_plans
    set price_cents = price_cents
    where id = (select min(id) from public.service_rate_plans)
    returning true
  $$,
  $$ values (true) $$,
  'content staff can edit hourly prices'
);
select results_eq(
  $$
    update public.package_rate_plans
    set price_cents = price_cents
    where id = (select min(id) from public.package_rate_plans)
    returning true
  $$,
  $$ values (true) $$,
  'content staff can edit package prices'
);
select is(
  public.update_seat_type_rate('cms-test', 6000),
  3,
  'content staff can update a seat category rate'
);

reset role;
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', current_setting('test.customer_id'), 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select throws_ok(
  $$
    select public.create_booking(
      'Closure Test', 'maria.santos.jit@gmail.com', current_date + 70,
      '09:00'::time, 1::smallint, 'study-seat', array['TC91']
    )
  $$,
  'P0001',
  'The hub is closed during the selected reservation time',
  'active closure dates reject new reservations'
);
select throws_ok(
  $$
    select public.create_booking(
      'Seat Limit Test', 'maria.santos.jit@gmail.com', current_date + 71,
      '09:00'::time, 1::smallint, 'study-seat', array['TC91', 'TC92', 'TC93']
    )
  $$,
  '22023',
  'Choose between 1 and 2 seats',
  'the configured maximum seat count is enforced in the database'
);
select throws_ok(
  $$
    select public.create_booking(
      'Hours Test', 'maria.santos.jit@gmail.com', current_date + 72,
      '06:00'::time, 1::smallint, 'study-seat', array['TC91']
    )
  $$,
  '22023',
  'The reservation must be within configured operating hours',
  'reservations outside operating hours are rejected'
);
select throws_ok(
  $$
    select public.create_booking(
      'Duration Test', 'maria.santos.jit@gmail.com', current_date + 73,
      '09:00'::time, 5::smallint, 'study-seat', array['TC91']
    )
  $$,
  '22023',
  'Duration must be between 1 and 4 hours',
  'the configured duration limit is enforced in the database'
);
select throws_ok(
  $$
    select public.create_booking(
      'Advance Test', 'maria.santos.jit@gmail.com', (now() at time zone 'Asia/Manila')::date + 91,
      '09:00'::time, 1::smallint, 'study-seat', array['TC91']
    )
  $$,
  '22023',
  'Reservations can only be made up to 90 days ahead',
  'the configured advance-booking window is enforced in the database'
);

reset role;
select * from finish();
rollback;
