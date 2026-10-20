begin;
select plan(30);

select has_column('public', 'check_in_sessions', 'end_reminder_claimed_at', 'reminder claims are persisted');
select has_column('public', 'check_in_sessions', 'end_reminder_sent_at', 'successful reminder delivery is persisted');
select has_column('public', 'check_in_sessions', 'end_reminder_error', 'reminder delivery errors are persisted');
select has_function(
  'private',
  'calculate_booking_overtime',
  array['uuid', 'timestamp with time zone', 'timestamp with time zone'],
  'the shared overtime calculator exists'
);
select has_function(
  'private',
  'refresh_active_overtime_sessions',
  array[]::text[],
  'the active overtime refresher exists'
);
select ok(
  exists (
    select 1 from cron.job
    where jobname = 'process-reservation-time-notifications'
      and schedule = '* * * * *'
  ),
  'reservation time automation runs every minute'
);

select set_config('jit.seed_mode', 'on', true);
update public.check_in_sessions
set end_reminder_sent_at = now()
where end_reminder_sent_at is null;

insert into public.seats (id, code, name, zone, seat_type, hourly_rate_cents)
values
  ('f7100000-0000-4000-8000-000000000001', 'OT91', 'Overtime seat one', 'Test zone', 'individual', 5000),
  ('f7100000-0000-4000-8000-000000000002', 'OT92', 'Overtime seat two', 'Test zone', 'individual', 7500),
  ('f7100000-0000-4000-8000-000000000003', 'OT93', 'Reminder seat', 'Test zone', 'individual', 6000);

insert into public.bookings (
  id, reservation_code, user_id, guest_name, guest_email, booking_date,
  start_time, starts_at, ends_at, duration_hours, seat_ids, status,
  payment_status, subtotal_cents
)
select
  'f7200000-0000-4000-8000-000000000001',
  'TEST-OVERTIME-CHECKOUT',
  profile.id,
  'Overtime Guest',
  'overtime-test@gmail.com',
  ((now() - interval '81 minutes') at time zone 'Asia/Manila')::date,
  ((now() - interval '81 minutes') at time zone 'Asia/Manila')::time,
  now() - interval '81 minutes',
  now() - interval '21 minutes',
  1,
  array['OT91', 'OT92'],
  'checked_in',
  'paid',
  12500
from public.profiles as profile
where profile.email = 'maria.santos.jit@gmail.com';

insert into public.booking_seats (booking_id, seat_id, reserved_during)
select
  'f7200000-0000-4000-8000-000000000001',
  seat.id,
  tstzrange(now() - interval '81 minutes', now() - interval '21 minutes', '[)')
from public.seats as seat
where seat.code in ('OT91', 'OT92');

insert into public.qr_access_passes (id, booking_id, token_hash, expires_at)
values (
  'f7300000-0000-4000-8000-000000000001',
  'f7200000-0000-4000-8000-000000000001',
  'overtime-notification-test-token',
  now() - interval '1 minute'
);

insert into public.check_in_sessions (
  id, booking_id, qr_access_pass_id, status, checked_in_at, scheduled_end_at
)
values (
  'f7400000-0000-4000-8000-000000000001',
  'f7200000-0000-4000-8000-000000000001',
  'f7300000-0000-4000-8000-000000000001',
  'checked_in',
  now() - interval '81 minutes',
  now() - interval '21 minutes'
);

select is(
  (select overtime_minutes from private.calculate_booking_overtime(
    'f7200000-0000-4000-8000-000000000001', now(), now() + interval '19 minutes'
  )),
  19,
  'the calculator records overtime inside the grace period'
);
select is(
  (select charge_cents from private.calculate_booking_overtime(
    'f7200000-0000-4000-8000-000000000001', now(), now() + interval '19 minutes'
  )),
  0::bigint,
  '19 minutes overtime is free'
);
select is(
  (select billable_hours from private.calculate_booking_overtime(
    'f7200000-0000-4000-8000-000000000001', now(), now() + interval '20 minutes'
  )),
  1,
  '20 minutes overtime starts one billable hour'
);
select is(
  (select hourly_rate_cents from private.calculate_booking_overtime(
    'f7200000-0000-4000-8000-000000000001', now(), now() + interval '20 minutes'
  )),
  12500::bigint,
  'the hourly overtime rate includes every reserved seat'
);
select is(
  (select charge_cents from private.calculate_booking_overtime(
    'f7200000-0000-4000-8000-000000000001', now(), now() + interval '20 minutes'
  )),
  12500::bigint,
  'the first overtime hour uses the combined current seat price'
);
select is(
  (select charge_cents from private.calculate_booking_overtime(
    'f7200000-0000-4000-8000-000000000001', now(), now() + interval '61 minutes'
  )),
  25000::bigint,
  'overtime after one hour rounds up to two billable hours'
);

select cmp_ok(private.refresh_active_overtime_sessions(), '>=', 1, 'the refresher updates active late sessions');
select is(
  (select status::text from public.check_in_sessions where id = 'f7400000-0000-4000-8000-000000000001'),
  'overtime',
  'the active session is marked as overtime after 20 minutes'
);
select is(
  (select overtime_charge_cents from public.check_in_sessions where id = 'f7400000-0000-4000-8000-000000000001'),
  12500::bigint,
  'the live session stores the front-desk charge'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object('role', 'service_role')::text,
  true
);
set local role service_role;
select is(
  (select overtime_charge_cents from public.process_kiosk_scan('overtime-notification-test-token')),
  12500::bigint,
  'an already checked-in guest can check out with an expired pass and receives the charge'
);
reset role;
select is(
  (select status::text from public.bookings where id = 'f7200000-0000-4000-8000-000000000001'),
  'completed',
  'overtime checkout completes the booking'
);
select is(
  (select status::text from public.check_in_sessions where id = 'f7400000-0000-4000-8000-000000000001'),
  'checked_out',
  'overtime checkout closes the active session'
);
select ok(
  (select revoked_at is not null from public.qr_access_passes where id = 'f7300000-0000-4000-8000-000000000001'),
  'overtime checkout revokes the used pass'
);

insert into public.bookings (
  id, reservation_code, user_id, guest_name, guest_email, booking_date,
  start_time, starts_at, ends_at, duration_hours, seat_ids, status,
  payment_status, subtotal_cents
)
select
  'f7200000-0000-4000-8000-000000000002',
  'TEST-END-REMINDER',
  profile.id,
  'Reminder Guest',
  'reminder-test@gmail.com',
  ((now() - interval '35 minutes') at time zone 'Asia/Manila')::date,
  ((now() - interval '35 minutes') at time zone 'Asia/Manila')::time,
  now() - interval '35 minutes',
  now() + interval '25 minutes',
  1,
  array['OT93'],
  'checked_in',
  'paid',
  6000
from public.profiles as profile
where profile.email = 'maria.santos.jit@gmail.com';

insert into public.booking_seats (booking_id, seat_id, reserved_during)
select
  'f7200000-0000-4000-8000-000000000002',
  seat.id,
  tstzrange(now() - interval '35 minutes', now() + interval '25 minutes', '[)')
from public.seats as seat
where seat.code = 'OT93';

insert into public.qr_access_passes (id, booking_id, token_hash, expires_at)
values (
  'f7300000-0000-4000-8000-000000000002',
  'f7200000-0000-4000-8000-000000000002',
  'end-reminder-test-token',
  now() + interval '85 minutes'
);

insert into public.check_in_sessions (
  id, booking_id, qr_access_pass_id, status, checked_in_at, scheduled_end_at
)
values (
  'f7400000-0000-4000-8000-000000000002',
  'f7200000-0000-4000-8000-000000000002',
  'f7300000-0000-4000-8000-000000000002',
  'checked_in',
  now() - interval '35 minutes',
  now() + interval '25 minutes'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', (select id from public.profiles where email = 'maria.santos.jit@gmail.com'), 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select throws_ok(
  $$ select public.claim_end_time_reminders(50) $$,
  '42501',
  null,
  'customers cannot claim reminder emails'
);
reset role;

select set_config('request.jwt.claims', jsonb_build_object('role', 'service_role')::text, true);
set local role service_role;
select is(
  (select count(*) from public.claim_end_time_reminders(50)),
  1::bigint,
  'a checked-in reservation inside the 30-minute window is claimed once'
);
select is(
  (select hourly_rate_cents from public.claim_end_time_reminders(50)),
  null::bigint,
  'an active claim prevents duplicate reminder delivery'
);
reset role;
select ok(
  (select end_reminder_claimed_at is not null from public.check_in_sessions where id = 'f7400000-0000-4000-8000-000000000002'),
  'the claim timestamp is stored'
);
select set_config('request.jwt.claims', jsonb_build_object('role', 'service_role')::text, true);
set local role service_role;
select lives_ok(
  $$ select public.complete_end_time_reminder('f7400000-0000-4000-8000-000000000002', 'Provider unavailable') $$,
  'the service role can record a failed reminder attempt'
);
reset role;
select is(
  (select end_reminder_error from public.check_in_sessions where id = 'f7400000-0000-4000-8000-000000000002'),
  'Provider unavailable',
  'a failed reminder stores its delivery error'
);
select ok(
  (select end_reminder_claimed_at is not null from public.check_in_sessions where id = 'f7400000-0000-4000-8000-000000000002'),
  'a failed reminder keeps a claim timestamp for the retry cooldown'
);
update public.check_in_sessions
set end_reminder_claimed_at = now() - interval '11 minutes'
where id = 'f7400000-0000-4000-8000-000000000002';
select set_config('request.jwt.claims', jsonb_build_object('role', 'service_role')::text, true);
set local role service_role;
select is(
  (select count(*) from public.claim_end_time_reminders(50)),
  1::bigint,
  'a failed reminder becomes eligible after the ten-minute retry cooldown'
);
select lives_ok(
  $$ select public.complete_end_time_reminder('f7400000-0000-4000-8000-000000000002', null) $$,
  'the retried reminder can be completed successfully'
);
reset role;
select ok(
  (select end_reminder_sent_at is not null from public.check_in_sessions where id = 'f7400000-0000-4000-8000-000000000002'),
  'successful reminder delivery is marked sent'
);
select ok(
  (select end_reminder_claimed_at is null from public.check_in_sessions where id = 'f7400000-0000-4000-8000-000000000002'),
  'successful delivery clears the temporary claim'
);

select * from finish();
rollback;
