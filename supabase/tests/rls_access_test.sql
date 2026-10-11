BEGIN;
SELECT plan(16);

-- Add deterministic rows that should be hidden from public/customer roles.
INSERT INTO public.seats (
  code,
  name,
  zone,
  seat_type,
  hourly_rate_cents,
  is_active
) VALUES (
  'ZZ99',
  'RLS test seat',
  'Test zone',
  'individual',
  5000,
  false
);

INSERT INTO public.announcements (title, body, status)
VALUES ('RLS draft announcement', 'Only announcement staff should see this.', 'draft');

SELECT set_config('test.total_bookings', (SELECT count(*)::text FROM public.bookings), true);
SELECT set_config('test.total_profiles', (SELECT count(*)::text FROM public.profiles), true);
SELECT set_config('test.total_metrics', (SELECT count(*)::text FROM public.daily_business_metrics), true);

-- Anonymous visitors only receive explicitly public rows.
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.seats WHERE code = 'ZZ99'),
  'anonymous visitors cannot read inactive seats'
);
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.announcements WHERE title = 'RLS draft announcement'),
  'anonymous visitors cannot read draft announcements'
);

RESET ROLE;

-- A seeded customer can only read and update their own data.
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*) FROM public.profiles),
  1::bigint,
  'customers see exactly their own profile'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = 'b1000000-0000-4000-8000-000000000002'::uuid
  ),
  'customers cannot read another customer profile'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.bookings
    WHERE user_id <> 'b1000000-0000-4000-8000-000000000001'::uuid
  ),
  'customers cannot read another customer booking'
);
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.announcements WHERE title = 'RLS draft announcement'),
  'customers cannot read draft announcements'
);
SELECT results_eq(
  $$
    UPDATE public.profiles
    SET full_name = full_name
    WHERE id = 'b1000000-0000-4000-8000-000000000001'::uuid
    RETURNING id
  $$,
  $$ VALUES ('b1000000-0000-4000-8000-000000000001'::uuid) $$,
  'customers can update their own allowed profile fields'
);
SELECT is_empty(
  $$
    UPDATE public.profiles
    SET full_name = full_name
    WHERE id = 'b1000000-0000-4000-8000-000000000002'::uuid
    RETURNING id
  $$,
  'customers cannot update another profile'
);
SELECT throws_ok(
  $$ SELECT public.toggle_walk_in_occupancy('LA01', 'RLS test') $$,
  '42501',
  'Seating access required',
  'customers cannot invoke seating operations'
);

RESET ROLE;

-- Ramon is seeded with only the seating permission.
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*) FROM public.bookings),
  current_setting('test.total_bookings')::bigint,
  'seating staff can read all bookings needed for occupancy operations'
);
SELECT is(
  (SELECT count(*) FROM public.daily_business_metrics),
  0::bigint,
  'seating staff cannot read owner-only business metrics'
);
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.announcements WHERE title = 'RLS draft announcement'),
  'seating staff cannot read draft announcements'
);

RESET ROLE;

-- Sofia is seeded with only the announcements permission.
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;

SELECT ok(
  EXISTS (SELECT 1 FROM public.announcements WHERE title = 'RLS draft announcement'),
  'announcement staff can read draft announcements'
);
SELECT is(
  (SELECT count(*) FROM public.bookings),
  0::bigint,
  'announcement-only staff cannot read customer bookings'
);

RESET ROLE;

-- The seeded owner has all scoped access and owner-only analytics access.
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"7d3b185a-905f-4f7a-93ec-a9e5276cdfe2","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*) FROM public.profiles),
  current_setting('test.total_profiles')::bigint,
  'the owner can read every profile'
);
SELECT is(
  (SELECT count(*) FROM public.daily_business_metrics),
  current_setting('test.total_metrics')::bigint,
  'the owner can read business metrics'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
