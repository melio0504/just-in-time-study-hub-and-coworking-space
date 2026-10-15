begin;
select plan(18);

select set_config('test.customer_id', (
  select id::text from public.profiles where email = 'maria.santos.jit@gmail.com'
), true);
select set_config('test.other_customer_id', (
  select id::text from public.profiles where email = 'juan.delacruz.jit@gmail.com'
), true);

select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', current_setting('test.customer_id'), 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select set_config('test.paid_booking_id', (
  select id::text from public.create_booking(
    'Refund Workflow Test',
    'maria.santos.jit@gmail.com',
    current_date + 70,
    '10:00'::time,
    1::smallint,
    'study-seat',
    array['SO11']
  )
), true);
select set_config('test.unpaid_booking_id', (
  select id::text from public.create_booking(
    'Unpaid Cancellation Test',
    'maria.santos.jit@gmail.com',
    current_date + 71,
    '11:00'::time,
    1::smallint,
    'study-seat',
    array['SO12']
  )
), true);

reset role;
update public.bookings
set status = 'confirmed', payment_status = 'paid', hold_expires_at = null
where id = current_setting('test.paid_booking_id')::uuid;
insert into public.payments (
  booking_id, method, status, amount_cents, provider_payment_id, paid_at
) values (
  current_setting('test.paid_booking_id')::uuid,
  'qrph',
  'paid',
  5000,
  'pay_customer_refund_test',
  now()
);
insert into public.qr_access_passes (booking_id, token_hash, expires_at)
values (
  current_setting('test.paid_booking_id')::uuid,
  repeat('f', 64),
  now() + interval '80 days'
);

set local role service_role;
select throws_ok(
  format(
    'select * from public.prepare_customer_booking_cancellation(%L::uuid, %L::uuid)',
    current_setting('test.paid_booking_id'),
    current_setting('test.other_customer_id')
  ),
  'P0002',
  'Reservation not found',
  'the refund boundary rejects a booking owned by another customer'
);
select lives_ok(
  format(
    'select * from public.get_customer_booking_pass(%L::uuid, %L::uuid)',
    current_setting('test.paid_booking_id'),
    current_setting('test.customer_id')
  ),
  'the server can retrieve an owned kiosk pass for a receipt'
);
select set_config('test.refund_id', (
  select refund_id::text
  from public.prepare_customer_booking_cancellation(
    current_setting('test.paid_booking_id')::uuid,
    current_setting('test.customer_id')::uuid
  )
), true);
reset role;

select is(
  (select status from public.payment_refunds where id = current_setting('test.refund_id')::uuid),
  'processing',
  'preparation creates one processing refund operation'
);
set local role service_role;
select is(
  (
    select payment_livemode
    from public.prepare_customer_booking_cancellation(
      current_setting('test.paid_booking_id')::uuid,
      current_setting('test.customer_id')::uuid
    )
  ),
  false,
  'refund preparation identifies a test-mode payment for safe simulation'
);
reset role;
select is(
  (select status::text from public.bookings where id = current_setting('test.paid_booking_id')::uuid),
  'confirmed',
  'a paid reservation remains confirmed until PayMongo accepts the refund'
);

set local role service_role;
select lives_ok(
  format(
    'select public.finalize_customer_booking_refund(%L::uuid, %L, %L, null, null, %L::jsonb)',
    current_setting('test.refund_id'),
    'ref_customer_test',
    'pending',
    '{"data":{"id":"ref_customer_test"}}'
  ),
  'an accepted pending refund finalizes the customer cancellation'
);
reset role;

select is(
  (select status::text from public.bookings where id = current_setting('test.paid_booking_id')::uuid),
  'cancelled',
  'the accepted refund cancels the reservation'
);
select is(
  (select payment_status::text from public.bookings where id = current_setting('test.paid_booking_id')::uuid),
  'processing',
  'the booking exposes an in-progress refund'
);
select ok(
  not exists (
    select 1 from public.booking_seats
    where booking_id = current_setting('test.paid_booking_id')::uuid and active
  ),
  'cancellation releases every reserved seat'
);
select ok(
  (select revoked_at is not null from public.qr_access_passes where booking_id = current_setting('test.paid_booking_id')::uuid),
  'cancellation revokes the kiosk pass'
);

set local role service_role;
select lives_ok(
  format(
    'select public.finalize_customer_booking_refund(%L::uuid, %L, %L, null, null, %L::jsonb)',
    current_setting('test.refund_id'),
    'ref_customer_test',
    'succeeded',
    '{"data":{"id":"ref_customer_test"}}'
  ),
  'a provider success event completes the refund'
);
select is(
  (
    select refund_id::text
    from public.prepare_customer_booking_cancellation(
      current_setting('test.paid_booking_id')::uuid,
      current_setting('test.customer_id')::uuid
    )
  ),
  current_setting('test.refund_id'),
  'retries return the same idempotent refund operation'
);
select lives_ok(
  format(
    'select * from public.prepare_customer_booking_cancellation(%L::uuid, %L::uuid)',
    current_setting('test.unpaid_booking_id'),
    current_setting('test.customer_id')
  ),
  'the same server workflow cancels an unpaid reservation'
);
reset role;

select is(
  (select payment_status::text from public.bookings where id = current_setting('test.paid_booking_id')::uuid),
  'refunded',
  'the booking records the completed refund'
);
select is(
  (select status::text from public.payments where booking_id = current_setting('test.paid_booking_id')::uuid),
  'refunded',
  'the provider payment records the completed refund'
);
select is(
  (select status::text from public.bookings where id = current_setting('test.unpaid_booking_id')::uuid),
  'cancelled',
  'the unpaid reservation is cancelled without a provider refund'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', current_setting('test.customer_id'), 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select is(
  (select count(*)::integer from public.payment_refunds where booking_id = current_setting('test.paid_booking_id')::uuid),
  1,
  'RLS lets a customer view the refund for their own reservation'
);
reset role;
select ok(
  not has_function_privilege('authenticated', 'public.prepare_customer_booking_cancellation(uuid, uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.finalize_customer_booking_refund(uuid, text, text, text, text, jsonb)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.get_customer_booking_pass(uuid, uuid)', 'EXECUTE'),
  'customers cannot call server-only cancellation, refund, or pass RPCs directly'
);

select * from finish();
rollback;
