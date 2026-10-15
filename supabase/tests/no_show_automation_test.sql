begin;
select plan(17);

select has_extension('pg_cron', 'pg_cron is enabled for scheduled automation');
select has_column('public', 'booking_settings', 'no_show_grace_minutes', 'the no-show grace period is configurable');
select is(
  (select no_show_grace_minutes from public.booking_settings where singleton),
  30,
  'the default no-show grace period is 30 minutes'
);
select has_function(
  'private',
  'mark_overdue_bookings_no_show',
  array[]::text[],
  'the private no-show processor exists'
);
select ok(
  exists (
    select 1 from cron.job
    where jobname = 'mark-overdue-reservations-no-show'
      and schedule = '* * * * *'
  ),
  'the no-show processor is scheduled every minute'
);

select set_config('jit.seed_mode', 'on', true);
insert into public.seats (id, code, name, zone, seat_type, hourly_rate_cents)
values
  ('f6100000-0000-4000-8000-000000000001', 'NS91', 'No-show release seat', 'Test zone', 'individual', 5000),
  ('f6100000-0000-4000-8000-000000000002', 'NS92', 'Within-grace seat', 'Test zone', 'individual', 5000),
  ('f6100000-0000-4000-8000-000000000003', 'NS93', 'Checked-in seat', 'Test zone', 'individual', 5000);

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
  'no-show-test@gmail.com',
  (fixture.starts_at at time zone 'Asia/Manila')::date,
  (fixture.starts_at at time zone 'Asia/Manila')::time,
  fixture.starts_at,
  fixture.starts_at + interval '2 hours',
  2,
  fixture.seat_ids,
  fixture.status,
  'paid',
  10000
from (
  values
    ('f6200000-0000-4000-8000-000000000001'::uuid, 'TEST-NOSHOW-LATE', 'Late Guest', now() - interval '35 minutes', array['NS91']::text[], 'confirmed'::public.booking_status),
    ('f6200000-0000-4000-8000-000000000002'::uuid, 'TEST-NOSHOW-GRACE', 'Grace Guest', now() - interval '5 minutes', array['NS92']::text[], 'confirmed'::public.booking_status),
    ('f6200000-0000-4000-8000-000000000003'::uuid, 'TEST-NOSHOW-CHECKED-IN', 'Checked-in Guest', now() - interval '35 minutes', array['NS93']::text[], 'checked_in'::public.booking_status)
) as fixture(id, reservation_code, guest_name, starts_at, seat_ids, status)
cross join lateral (
  select id from public.profiles where email = 'maria.santos.jit@gmail.com'
) as customer;

insert into public.booking_seats (booking_id, seat_id, reserved_during)
select booking.id, seat.id, tstzrange(booking.starts_at, booking.ends_at, '[)')
from public.bookings as booking
join public.seats as seat on seat.code = any(booking.seat_ids)
where booking.id in (
  'f6200000-0000-4000-8000-000000000001',
  'f6200000-0000-4000-8000-000000000002',
  'f6200000-0000-4000-8000-000000000003'
);

insert into public.qr_access_passes (booking_id, token_hash, expires_at)
values (
  'f6200000-0000-4000-8000-000000000001',
  'no-show-automation-test-token',
  now() + interval '2 hours'
);

select is(
  private.mark_overdue_bookings_no_show(),
  1,
  'only one overdue confirmed reservation is processed'
);
select is(
  (select status::text from public.bookings where id = 'f6200000-0000-4000-8000-000000000001'),
  'no_show',
  'an overdue confirmed reservation becomes a no-show'
);
select is(
  (select status::text from public.bookings where id = 'f6200000-0000-4000-8000-000000000002'),
  'confirmed',
  'a reservation inside the grace period stays confirmed'
);
select is(
  (select status::text from public.bookings where id = 'f6200000-0000-4000-8000-000000000003'),
  'checked_in',
  'a checked-in reservation is never marked as a no-show'
);
select is(
  (select count(*) from public.booking_seats where booking_id = 'f6200000-0000-4000-8000-000000000001' and active),
  0::bigint,
  'the no-show transition releases every reserved seat'
);
select ok(
  (select revoked_at is not null from public.qr_access_passes where booking_id = 'f6200000-0000-4000-8000-000000000001'),
  'the no-show QR pass is revoked'
);
select ok(
  exists (
    select 1 from public.audit_logs
    where entity_id = 'f6200000-0000-4000-8000-000000000001'
      and action = 'Reservation marked no-show'
      and details ->> 'source' = 'automation'
  ),
  'the automated transition is written to the audit log'
);
select ok(
  exists (
    select 1
    from public.get_available_seats(now(), now() + interval '15 minutes')
    where code = 'NS91'
  ),
  'the released seat becomes available immediately'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select id from public.profiles where email = 'admin@jit-studyhub.com'),
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select throws_ok(
  $$ select public.start_walk_in('NS92', 'Too-early walk-in') $$,
  'P0001',
  'This seat is reserved for an active reservation',
  'a confirmed reservation still inside the grace period protects its seat'
);
select lives_ok(
  $$ select public.start_walk_in('NS91', 'Walk-in after no-show') $$,
  'staff can place a walk-in in the released seat'
);
select ok(
  exists (
    select 1
    from public.walk_in_occupancies as occupancy
    join public.seats as seat on seat.id = occupancy.seat_id
    where seat.code = 'NS91' and occupancy.ended_at is null
  ),
  'the released seat now has an active walk-in'
);
select throws_ok(
  $$ select private.mark_overdue_bookings_no_show() $$,
  '42501',
  null,
  'application users cannot invoke the private automation function'
);

reset role;
select * from finish();
rollback;
