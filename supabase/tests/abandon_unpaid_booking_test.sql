begin;
select plan(14);

select set_config('test.customer_id', (
  select id::text from public.profiles where email = 'maria.santos.jit@gmail.com'
), true);
select set_config('test.other_customer_id', (
  select id::text from public.profiles where email = 'juan.delacruz.jit@gmail.com'
), true);

insert into public.seats (code, name, zone, seat_type, hourly_rate_cents)
values ('TX98', 'Abandonment test seat', 'Test zone', 'individual', 5000);

create temporary table abandonment_booking_id as
with inserted as (
  insert into public.bookings (
    reservation_code, user_id, guest_name, guest_email, booking_date, start_time,
    starts_at, ends_at, duration_hours, seat_ids, subtotal_cents, hold_expires_at
  )
  values (
    'JIT-ABANDON-TEST',
    current_setting('test.customer_id')::uuid,
    'Abandonment Test',
    'maria.santos.jit@gmail.com',
    current_date + 90,
    '09:00'::time,
    ((current_date + 90)::timestamp + time '09:00') at time zone 'Asia/Manila',
    ((current_date + 90)::timestamp + time '10:00') at time zone 'Asia/Manila',
    1,
    array['TX98'],
    5000,
    now() + interval '15 minutes'
  )
  returning id::text
)
select id from inserted;

select set_config('test.booking_id', (select id from abandonment_booking_id), true);

insert into public.booking_seats (booking_id, seat_id, reserved_during)
select
  abandonment_booking_id.id::uuid,
  seat.id,
  tstzrange(
    ((current_date + 90)::timestamp + time '09:00') at time zone 'Asia/Manila',
    ((current_date + 90)::timestamp + time '10:00') at time zone 'Asia/Manila',
    '[)'
  )
from abandonment_booking_id
cross join public.seats seat
where seat.code = 'TX98';

insert into public.payments (
  booking_id, method, status, amount_cents, provider_payment_intent_id,
  provider_payment_method_id, provider_status, qr_expires_at, livemode
)
select
  id::uuid, 'qrph', 'processing', 5000, 'pi_abandonmenttest',
  'pm_abandonmenttest', 'awaiting_next_action', now() + interval '15 minutes', false
from abandonment_booking_id;

select ok(
  not has_function_privilege(
    'authenticated',
    'public.abandon_unpaid_booking(uuid,uuid)',
    'execute'
  ),
  'browser sessions cannot abandon a reservation through the server-only RPC'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.prepare_booking_abandonment(uuid,uuid)',
    'execute'
  ),
  'browser sessions cannot inspect abandonment payment details'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.abandon_unpaid_booking(uuid,uuid)',
    'execute'
  ),
  'the trusted Edge Function can abandon an unpaid reservation'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.prepare_booking_abandonment(uuid,uuid)',
    'execute'
  ),
  'the trusted Edge Function can inspect abandonment payment details'
);

set local role service_role;
select throws_ok(
  format(
    'select public.abandon_unpaid_booking(%L::uuid, %L::uuid)',
    current_setting('test.booking_id'),
    current_setting('test.other_customer_id')
  ),
  'P0002',
  'Reservation not found',
  'a customer cannot abandon another customer reservation'
);
select lives_ok(
  format(
    'select public.abandon_unpaid_booking(%L::uuid, %L::uuid)',
    current_setting('test.booking_id'),
    current_setting('test.customer_id')
  ),
  'an owned unpaid QR Ph checkout can be abandoned'
);
reset role;

select is(
  (select status::text from public.bookings where id = current_setting('test.booking_id')::uuid),
  'declined',
  'an abandoned checkout is declined rather than cancelled'
);
select is(
  (select payment_status::text from public.bookings where id = current_setting('test.booking_id')::uuid),
  'failed',
  'the abandoned booking records no successful payment'
);
select is(
  (select status::text from public.payments where booking_id = current_setting('test.booking_id')::uuid),
  'failed',
  'the abandoned payment is failed'
);
select is(
  (select failure_code from public.payments where booking_id = current_setting('test.booking_id')::uuid),
  'payment_abandoned',
  'the payment records why it stopped'
);
select is(
  (
    select count(*)
    from public.booking_seats
    where booking_id = current_setting('test.booking_id')::uuid and active
  ),
  0::bigint,
  'abandoning checkout releases its seats'
);
select ok(
  exists (
    select 1
    from public.bookings
    where id = current_setting('test.booking_id')::uuid
      and cancelled_at is null
      and cancellation_reason is null
  ),
  'abandonment does not populate cancellation metadata'
);
select ok(
  exists (
    select 1
    from public.audit_logs
    where entity_id = current_setting('test.booking_id')
      and action = 'Abandoned unpaid QR Ph checkout'
  ),
  'abandonment remains auditable outside customer reservation history'
);

update public.bookings
set status = 'confirmed', payment_status = 'paid'
where id = current_setting('test.booking_id')::uuid;
update public.payments
set status = 'paid', provider_payment_id = 'pay_abandonmentrace', paid_at = now()
where booking_id = current_setting('test.booking_id')::uuid;

set local role service_role;
select throws_ok(
  format(
    'select public.abandon_unpaid_booking(%L::uuid, %L::uuid)',
    current_setting('test.booking_id'),
    current_setting('test.customer_id')
  ),
  'P0001',
  'This reservation can no longer be abandoned',
  'a paid reservation cannot lose its confirmed state during an abandonment race'
);
reset role;

select * from finish();
rollback;
