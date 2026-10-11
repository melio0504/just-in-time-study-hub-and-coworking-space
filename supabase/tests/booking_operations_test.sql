BEGIN;
SELECT plan(18);

-- A dedicated seat keeps the walk-in tests independent from seeded occupancy.
INSERT INTO public.seats (
  code,
  name,
  zone,
  seat_type,
  hourly_rate_cents
) VALUES (
  'TZ99',
  'Transaction test seat',
  'Test zone',
  'individual',
  5000
);

-- Exercise the same authenticated RPC used by the public booking application.
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;

SELECT set_config(
  'test.booking_id',
  (
    SELECT id::text
    FROM public.create_booking(
      '  Maria Transaction  ',
      'MARIA.TRANSACTION@EXAMPLE.TEST',
      (current_date + 30),
      '09:00'::time,
      1::smallint,
      'study-seat',
      ARRAY['LA01', 'LA02']
    )
  ),
  true
);

SELECT is(
  (SELECT guest_name FROM public.bookings WHERE id = current_setting('test.booking_id')::uuid),
  'Maria Transaction',
  'booking creation trims the guest name'
);
SELECT is(
  (SELECT guest_email FROM public.bookings WHERE id = current_setting('test.booking_id')::uuid),
  'maria.transaction@example.test',
  'booking creation normalizes the guest email'
);
SELECT is(
  (SELECT subtotal_cents FROM public.bookings WHERE id = current_setting('test.booking_id')::uuid),
  10000::bigint,
  'booking creation calculates the subtotal from every selected seat'
);
SELECT is(
  (
    SELECT count(*)
    FROM public.booking_seats
    WHERE booking_id = current_setting('test.booking_id')::uuid
      AND active
  ),
  2::bigint,
  'booking creation reserves every selected seat atomically'
);

-- Use a second customer so the per-customer pending hold guard does not mask
-- the seat-overlap behavior under test.
RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$
    SELECT public.create_booking(
      'Overlap Test',
      'overlap@example.test',
      (current_date + 30),
      '09:30'::time,
      1::smallint,
      'study-seat',
      ARRAY['LA01']
    )
  $$,
  '23P01',
  'One or more seats were just reserved for that time',
  'overlapping bookings cannot reserve the same seat'
);

-- Use another customer to reach input validation independently of any hold.
RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$
    SELECT public.create_booking(
      'Duplicate Test',
      'duplicate@example.test',
      (current_date + 30),
      '11:00'::time,
      1::smallint,
      'study-seat',
      ARRAY['LA01', 'LA01']
    )
  $$,
  '22023',
  'Choose between 1 and 5 unique seats',
  'a booking rejects duplicate seat codes'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.get_available_seats(
      ((current_date + 30)::timestamp + time '09:30') AT TIME ZONE 'Asia/Manila',
      ((current_date + 30)::timestamp + time '10:30') AT TIME ZONE 'Asia/Manila'
    )
    WHERE code = 'LA01'
  ),
  'an actively reserved seat is excluded from availability'
);

SELECT lives_ok(
  format('SELECT public.cancel_booking(%L::uuid)', current_setting('test.booking_id')),
  'a customer can cancel their own future booking'
);
SELECT is(
  (SELECT status::text FROM public.bookings WHERE id = current_setting('test.booking_id')::uuid),
  'cancelled',
  'customer cancellation transitions the booking status'
);
SELECT is(
  (
    SELECT count(*)
    FROM public.booking_seats
    WHERE booking_id = current_setting('test.booking_id')::uuid
      AND active
  ),
  0::bigint,
  'customer cancellation releases every linked seat reservation'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.get_available_seats(
      ((current_date + 30)::timestamp + time '09:30') AT TIME ZONE 'Asia/Manila',
      ((current_date + 30)::timestamp + time '10:30') AT TIME ZONE 'Asia/Manila'
    )
    WHERE code = 'LA01'
  ),
  'a cancelled booking makes its seat available again'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
SELECT set_config(
  'test.other_booking_id',
  (
    SELECT id::text
    FROM public.create_booking(
      'Juan Transaction',
      'juan.transaction@example.test',
      (current_date + 31),
      '11:00'::time,
      1::smallint,
      'study-seat',
      ARRAY['LB01']
    )
  ),
  true
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  format('SELECT public.cancel_booking(%L::uuid)', current_setting('test.other_booking_id')),
  'P0001',
  'Booking cannot be cancelled',
  'a customer cannot cancel another customer booking'
);

-- Ramon has seating permission and can check a walk-in in and back out.
RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
SELECT is(
  public.toggle_walk_in_occupancy('tz99', 'Walk-in Test'),
  true,
  'seating staff can check a walk-in into an available seat'
);
SELECT is(
  (
    SELECT count(*)
    FROM public.walk_in_occupancies AS occupancy
    JOIN public.seats AS seat ON seat.id = occupancy.seat_id
    WHERE seat.code = 'TZ99' AND occupancy.ended_at IS NULL
  ),
  1::bigint,
  'walk-in check-in creates one active occupancy'
);
SELECT is(
  public.toggle_walk_in_occupancy('TZ99', NULL),
  false,
  'toggling an occupied seat checks the walk-in out'
);

RESET ROLE;
SELECT is(
  (
    SELECT count(*)
    FROM public.walk_in_occupancies AS occupancy
    JOIN public.seats AS seat ON seat.id = occupancy.seat_id
    WHERE seat.code = 'TZ99' AND occupancy.ended_at IS NOT NULL
  ),
  1::bigint,
  'walk-in checkout closes the active occupancy'
);
SELECT is(
  (
    SELECT count(*)
    FROM public.audit_logs
    WHERE entity_type = 'seat' AND entity_id IN ('tz99', 'TZ99')
  ),
  2::bigint,
  'walk-in transitions create an audit record for check-in and checkout'
);

-- Sofia only has announcement access and cannot operate seating.
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ SELECT public.toggle_walk_in_occupancy('TZ99', 'Unauthorized') $$,
  '42501',
  'Seating access required',
  'announcement-only staff cannot perform seating operations'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
