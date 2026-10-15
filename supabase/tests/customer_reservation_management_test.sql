begin;
select plan(21);

select set_config('test.customer_id', (
  select id::text from public.profiles where email = 'maria.santos.jit@gmail.com'
), true);
select set_config('test.other_customer_id', (
  select id::text from public.profiles where email = 'juan.delacruz.jit@gmail.com'
), true);

insert into public.seats (code, name, zone, seat_type, hourly_rate_cents)
values ('TP98', 'Premium transaction seat', 'Test zone', 'individual', 6000);

select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', current_setting('test.customer_id'), 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select set_config('test.booking_id', (
  select id::text
  from public.create_booking(
    'Reservation Manager Test',
    'maria.santos.jit@gmail.com',
    current_date + 50,
    '09:00'::time,
    1::smallint,
    'study-seat',
    array['SO03']
  )
), true);

reset role;
update public.bookings
set status = 'confirmed', payment_status = 'paid', hold_expires_at = null
where id = current_setting('test.booking_id')::uuid;
insert into public.payments (booking_id, method, status, amount_cents, paid_at)
values (current_setting('test.booking_id')::uuid, 'qrph', 'paid', 5000, now());
insert into public.qr_access_passes (booking_id, token_hash, expires_at)
values (
  current_setting('test.booking_id')::uuid,
  repeat('a', 64),
  now() + interval '60 days'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', current_setting('test.other_customer_id'), 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select set_config('test.other_booking_id', (
  select id::text
  from public.create_booking(
    'Availability Conflict Test',
    'juan.delacruz.jit@gmail.com',
    current_date + 51,
    '14:00'::time,
    1::smallint,
    'study-seat',
    array['SO05']
  )
), true);

reset role;
update public.bookings
set status = 'confirmed', payment_status = 'not_required', hold_expires_at = null
where id = current_setting('test.other_booking_id')::uuid;

select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', current_setting('test.customer_id'), 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select lives_ok(
  format(
    'select public.customer_update_booking(%L::uuid, current_date + 51, %L::time, array[%L])',
    current_setting('test.booking_id'),
    '14:00',
    'SO04'
  ),
  'a customer can reschedule and change seats on an eligible reservation'
);
select is(
  (select booking_date from public.bookings where id = current_setting('test.booking_id')::uuid),
  current_date + 51,
  'the booking date is updated'
);
select is(
  (select start_time from public.bookings where id = current_setting('test.booking_id')::uuid),
  '14:00'::time,
  'the booking start time is updated'
);
select is(
  (select seat_ids from public.bookings where id = current_setting('test.booking_id')::uuid),
  array['SO04']::text[],
  'the booking seat summary is updated'
);
select is(
  (
    select s.code
    from public.booking_seats bs
    join public.seats s on s.id = bs.seat_id
    where bs.booking_id = current_setting('test.booking_id')::uuid and bs.active
  ),
  'SO04',
  'the atomic seat reservation is replaced'
);
select is(
  (
    select q.expires_at
    from public.qr_access_passes q
    where q.booking_id = current_setting('test.booking_id')::uuid
  ),
  (
    select b.ends_at + interval '1 hour'
    from public.bookings b
    where b.id = current_setting('test.booking_id')::uuid
  ),
  'the QR pass expiry follows the revised reservation end'
);
select ok(
  exists (
    select 1 from public.get_available_seats_for_booking(
      current_setting('test.booking_id')::uuid,
      ((current_date + 51)::timestamp + time '14:00') at time zone 'Asia/Manila',
      ((current_date + 51)::timestamp + time '15:00') at time zone 'Asia/Manila'
    ) where code = 'SO04'
  ),
  'availability excludes the customer booking itself'
);
select ok(
  not exists (
    select 1 from public.get_available_seats_for_booking(
      current_setting('test.booking_id')::uuid,
      ((current_date + 51)::timestamp + time '14:00') at time zone 'Asia/Manila',
      ((current_date + 51)::timestamp + time '15:00') at time zone 'Asia/Manila'
    ) where code = 'SO05'
  ),
  'availability still excludes another reservation'
);

reset role;
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', current_setting('test.other_customer_id'), 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select throws_ok(
  format(
    'select * from public.get_available_seats_for_booking(%L::uuid, now() + interval %L, now() + interval %L)',
    current_setting('test.booking_id'),
    '1 day',
    '2 days'
  ),
  'P0002',
  'Reservation not found',
  'another customer cannot inspect booking-specific availability'
);
select throws_ok(
  format(
    'select public.customer_update_booking(%L::uuid, current_date + 52, %L::time, array[%L])',
    current_setting('test.booking_id'),
    '10:00',
    'SO06'
  ),
  'P0002',
  'Reservation not found',
  'another customer cannot update the reservation'
);

reset role;
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', current_setting('test.customer_id'), 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select throws_ok(
  format(
    'select public.customer_update_booking(%L::uuid, current_date + 52, %L::time, array[%L])',
    current_setting('test.booking_id'),
    '10:00',
    'TP98'
  ),
  'P0001',
  'Choose seats with the same total price as the paid reservation',
  'a customer cannot change a paid reservation total'
);
select throws_ok(
  format(
    'select public.customer_update_booking(%L::uuid, current_date + 52, %L::time, array[%L, %L])',
    current_setting('test.booking_id'),
    '10:00',
    'SO03',
    'SO04'
  ),
  '22023',
  'Choose between 1 and 1 unique seats (the number paid for)',
  'a customer cannot select more seats than the original paid quantity'
);
select throws_ok(
  format(
    'select public.customer_update_booking(%L::uuid, current_date + 52, %L::time, array[%L])',
    current_setting('test.booking_id'),
    '06:00',
    'SO04'
  ),
  '22023',
  'Choose an hourly start time while the hub is open',
  'rescheduling enforces the hub operating window'
);
select throws_ok(
  format('select public.cancel_booking(%L::uuid)', current_setting('test.booking_id')),
  'P0001',
  'Booking cannot be cancelled',
  'paid reservations remain protected from cancellation without a refund flow'
);

reset role;
set local role service_role;
select lives_ok(
  format(
    'select * from public.prepare_booking_pass_resend(%L::uuid, %L::uuid)',
    current_setting('test.booking_id'),
    current_setting('test.customer_id')
  ),
  'the server can prepare an owned active QR pass for resend'
);
reset role;
insert into public.walk_in_occupancies (
  seat_id, guest_name, started_at, business_date, status, payment_status, created_by
)
select s.id, 'Active Walk-in Test', now(),
  (((now() at time zone 'Asia/Manila') - interval '8 hours')::date),
  'active', 'unpaid', current_setting('test.customer_id')::uuid
from public.seats s where s.code = 'SO06';

select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', current_setting('test.customer_id'), 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select ok(
  not exists (
    select 1 from public.get_available_seats_for_booking(
      current_setting('test.booking_id')::uuid,
      now(),
      now() + interval '1 hour'
    ) where code = 'SO06'
  ),
  'active walk-in seats are marked unavailable in the rescheduling plan'
);

reset role;
select ok(
  (select confirmation_email_sent_at is not null from public.bookings where id = current_setting('test.booking_id')::uuid),
  'preparing a resend reserves its cooldown timestamp'
);
set local role service_role;
select throws_ok(
  format(
    'select * from public.prepare_booking_pass_resend(%L::uuid, %L::uuid)',
    current_setting('test.booking_id'),
    current_setting('test.customer_id')
  ),
  'P0001',
  'Please wait one minute before resending this QR pass',
  'concurrent QR-pass resends are rate limited'
);

reset role;
select ok(
  not has_function_privilege('authenticated', 'public.prepare_booking_pass_resend(uuid, uuid)', 'EXECUTE'),
  'customers cannot call the server-only resend preparation function directly'
);
select ok(
  has_function_privilege('authenticated', 'public.customer_update_booking(uuid, date, time without time zone, text[])', 'EXECUTE'),
  'authenticated customers can call the ownership-checked update function'
);
select ok(
  has_function_privilege('authenticated', 'public.get_available_seats_for_booking(uuid, timestamp with time zone, timestamp with time zone)', 'EXECUTE'),
  'authenticated customers can call booking-aware availability'
);

select * from finish();
rollback;
