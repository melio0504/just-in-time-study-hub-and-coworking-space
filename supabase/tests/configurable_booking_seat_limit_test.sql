begin;
select plan(6);

select set_config(
  'test.customer_id',
  (select id::text from public.profiles where email = 'maria.santos.jit@gmail.com'),
  true
);
select set_config(
  'test.content_staff_id',
  (select id::text from public.profiles where email = 'sofia.mercado@jit-studyhub.com'),
  true
);

insert into public.seats (code, name, zone, seat_type, hourly_rate_cents)
select
  'CF' || lpad(seat_number::text, 2, '0'),
  'Configurable limit test seat ' || seat_number,
  'Test zone',
  'individual',
  5000
from generate_series(1, 11) as seat_number;

select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', current_setting('test.content_staff_id'), 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select lives_ok(
  $$ update public.booking_settings set max_seats_per_booking = 10 where singleton $$,
  'authorized staff can configure booking limits above five'
);
select is(
  (select max_seats_per_booking from public.booking_settings where singleton),
  10::smallint,
  'the configured maximum seat count is stored'
);
select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.booking_settings'::regclass
      and conname = 'booking_settings_max_seats_per_booking_check'
  ),
  'max_seats_per_booking <= 49',
  'the database caps the setting at the floor-plan capacity'
);

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is(
  (select max_seats_per_booking from public.booking_settings where singleton),
  10::smallint,
  'the customer website can read the limit saved by staff'
);

reset role;
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', current_setting('test.customer_id'), 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select is(
  (
    select cardinality(seat_ids)
    from public.create_booking(
      'Configurable Limit Test',
      'maria.santos.jit@gmail.com',
      current_date + 40,
      '09:00'::time,
      1::smallint,
      'study-seat',
      array['CF01', 'CF02', 'CF03', 'CF04', 'CF05', 'CF06']
    )
  ),
  6,
  'new reservations can exceed the old hard-coded five-seat limit'
);
select throws_ok(
  $$
    select public.create_booking(
      'Configured Limit Rejection Test',
      'maria.santos.jit@gmail.com',
      current_date + 41,
      '09:00'::time,
      1::smallint,
      'study-seat',
      array['CF01', 'CF02', 'CF03', 'CF04', 'CF05', 'CF06', 'CF07', 'CF08', 'CF09', 'CF10', 'CF11']
    )
  $$,
  '22023',
  'Choose between 1 and 10 unique seats',
  'new reservations enforce the configured maximum seat count'
);

reset role;
select * from finish();
rollback;
