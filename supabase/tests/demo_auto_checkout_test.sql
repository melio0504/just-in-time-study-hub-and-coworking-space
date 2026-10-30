begin;
select plan(16);

select has_function(
  'private',
  'auto_checkout_expired_demo_bookings',
  array[]::text[],
  'the private demo checkout processor exists'
);
select ok(
  exists (
    select 1
    from cron.job
    where jobname = 'process-reservation-time-notifications'
      and schedule = '* * * * *'
  ),
  'the shared reservation automation runs every minute'
);

select set_config('jit.seed_mode', 'on', true);

insert into public.seats (id, code, name, zone, seat_type, hourly_rate_cents, status)
values
  ('f8100000-0000-4000-8000-000000000001', 'DA91', 'Expired demo seat', 'Test zone', 'individual', 5000, 'occupied'),
  ('f8100000-0000-4000-8000-000000000002', 'DA92', 'Expired real seat', 'Test zone', 'individual', 5000, 'occupied');

insert into public.bookings (
  id, reservation_code, user_id, guest_name, guest_email, booking_date,
  start_time, starts_at, ends_at, duration_hours, seat_ids, status,
  payment_status, subtotal_cents
)
select
  fixture.id,
  fixture.reservation_code,
  customer.id,
  fixture.guest_name,
  'demo-auto-checkout-test@gmail.com',
  (fixture.starts_at at time zone 'Asia/Manila')::date,
  (fixture.starts_at at time zone 'Asia/Manila')::time,
  fixture.starts_at,
  fixture.starts_at + interval '1 hour',
  1,
  fixture.seat_ids,
  'checked_in',
  'not_required',
  5000
from (
  values
    ('f8200000-0000-4000-8000-000000000001'::uuid, 'JIT-DEMO-AUTO-CHECKOUT', 'Demo Guest', now() - interval '2 hours', array['DA91']::text[]),
    ('f8200000-0000-4000-8000-000000000002'::uuid, 'JIT-REAL-AUTO-CHECKOUT', 'Real Guest', now() - interval '2 hours', array['DA92']::text[])
) as fixture(id, reservation_code, guest_name, starts_at, seat_ids)
cross join lateral (
  select id from public.profiles where email = 'maria.santos.jit@gmail.com'
) as customer;

insert into public.booking_seats (booking_id, seat_id, reserved_during)
select booking.id, seat.id, tstzrange(booking.starts_at, booking.ends_at, '[)')
from public.bookings as booking
join public.seats as seat on seat.code = any(booking.seat_ids)
where booking.id in (
  'f8200000-0000-4000-8000-000000000001',
  'f8200000-0000-4000-8000-000000000002'
);

insert into public.qr_access_passes (id, booking_id, token_hash, expires_at)
values
  ('f8300000-0000-4000-8000-000000000001', 'f8200000-0000-4000-8000-000000000001', 'demo-auto-checkout-token', now() - interval '30 minutes'),
  ('f8300000-0000-4000-8000-000000000002', 'f8200000-0000-4000-8000-000000000002', 'real-auto-checkout-token', now() - interval '30 minutes');

insert into public.check_in_sessions (
  id, booking_id, qr_access_pass_id, status, checked_in_at, scheduled_end_at,
  overtime_minutes, overtime_charge_cents
)
select
  fixture.id,
  booking.id,
  pass.id,
  'overtime',
  booking.starts_at + interval '5 minutes',
  booking.ends_at,
  60,
  5000
from (
  values
    ('f8400000-0000-4000-8000-000000000001'::uuid, 'f8200000-0000-4000-8000-000000000001'::uuid),
    ('f8400000-0000-4000-8000-000000000002'::uuid, 'f8200000-0000-4000-8000-000000000002'::uuid)
) as fixture(id, booking_id)
join public.bookings as booking on booking.id = fixture.booking_id
join public.qr_access_passes as pass on pass.booking_id = booking.id;

select is(
  private.auto_checkout_expired_demo_bookings(),
  1,
  'only the expired demo reservation is checked out'
);
select is(
  (select status::text from public.bookings where id = 'f8200000-0000-4000-8000-000000000001'),
  'completed',
  'the demo booking is completed'
);
select is(
  (select status::text from public.check_in_sessions where booking_id = 'f8200000-0000-4000-8000-000000000001'),
  'checked_out',
  'the demo check-in session is closed'
);
select is(
  (select checked_out_at from public.check_in_sessions where booking_id = 'f8200000-0000-4000-8000-000000000001'),
  (select scheduled_end_at from public.check_in_sessions where booking_id = 'f8200000-0000-4000-8000-000000000001'),
  'the dummy guest checks out at the scheduled end'
);
select is(
  (select overtime_minutes from public.check_in_sessions where booking_id = 'f8200000-0000-4000-8000-000000000001'),
  0,
  'demo overtime minutes are cleared'
);
select ok(
  not exists (
    select 1 from public.booking_seats
    where booking_id = 'f8200000-0000-4000-8000-000000000001' and active
  ),
  'the demo seat hold is released'
);
select is(
  (select status::text from public.seats where code = 'DA91'),
  'available',
  'the demo seat becomes physically available'
);
select ok(
  (select revoked_at is not null from public.qr_access_passes where booking_id = 'f8200000-0000-4000-8000-000000000001'),
  'the demo QR pass is revoked'
);
select ok(
  exists (
    select 1 from public.audit_logs
    where entity_id = 'f8200000-0000-4000-8000-000000000001'
      and action = 'Demo reservation checked out automatically'
      and details ->> 'source' = 'automation'
  ),
  'the automatic checkout is audited'
);
select is(
  (select status::text from public.bookings where id = 'f8200000-0000-4000-8000-000000000002'),
  'checked_in',
  'a real checked-in booking is untouched'
);
select is(
  (select status::text from public.check_in_sessions where booking_id = 'f8200000-0000-4000-8000-000000000002'),
  'overtime',
  'a real overtime session remains active'
);
select is(
  (select status::text from public.seats where code = 'DA92'),
  'occupied',
  'the real booking seat remains occupied'
);
select is(
  private.auto_checkout_expired_demo_bookings(),
  0,
  'the processor is idempotent after checkout'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select id from public.profiles where email = 'maria.santos.jit@gmail.com'),
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select throws_ok(
  $$ select private.auto_checkout_expired_demo_bookings() $$,
  '42501',
  null,
  'application users cannot invoke the private demo automation function'
);
reset role;

select * from finish();
rollback;
