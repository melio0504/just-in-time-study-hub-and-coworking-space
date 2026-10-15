BEGIN;
SELECT plan(18);

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
SELECT set_config('test.maria_id', (SELECT id::text FROM public.profiles WHERE email = 'maria.santos.jit@gmail.com'), true);
SELECT set_config('test.juan_id', (SELECT id::text FROM public.profiles WHERE email = 'juan.delacruz.jit@gmail.com'), true);
SELECT set_config('test.ramon_id', (SELECT id::text FROM public.profiles WHERE email = 'ramon.deleon@jit-studyhub.com'), true);
SELECT set_config('test.sofia_id', (SELECT id::text FROM public.profiles WHERE email = 'sofia.mercado@jit-studyhub.com'), true);
SELECT set_config('test.admin_id', (SELECT id::text FROM public.profiles WHERE email = 'admin@jit-studyhub.com'), true);

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
  jsonb_build_object('sub', current_setting('test.maria_id'), 'role', 'authenticated')::text,
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
    WHERE id = current_setting('test.juan_id')::uuid
  ),
  'customers cannot read another customer profile'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.bookings
    WHERE user_id <> current_setting('test.maria_id')::uuid
  ),
  'customers cannot read another customer booking'
);
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.announcements WHERE title = 'RLS draft announcement'),
  'customers cannot read draft announcements'
);
SELECT results_eq(
  format($$
    UPDATE public.profiles
    SET full_name = full_name
    WHERE id = %L::uuid
    RETURNING id
  $$, current_setting('test.maria_id')),
  format($$ VALUES (%L::uuid) $$, current_setting('test.maria_id')),
  'customers can update their own allowed profile fields'
);
SELECT is_empty(
  format($$
    UPDATE public.profiles
    SET full_name = full_name
    WHERE id = %L::uuid
    RETURNING id
  $$, current_setting('test.juan_id')),
  'customers cannot update another profile'
);
SELECT throws_ok(
  $$ SELECT public.toggle_walk_in_occupancy('SO01', 'RLS test') $$,
  '42501',
  'Seating access required',
  'customers cannot invoke seating operations'
);
SELECT throws_ok(
  $$ SELECT public.process_kiosk_scan(repeat('0', 64)) $$,
  '42501',
  'This kiosk is not signed in with seating access',
  'customers cannot invoke kiosk scans'
);

RESET ROLE;

-- Ramon is seeded with only the seating permission.
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', current_setting('test.ramon_id'), 'role', 'authenticated')::text,
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
SELECT throws_ok(
  $$ SELECT public.process_kiosk_scan(repeat('0', 64)) $$,
  'P0001',
  'Invalid or already used QR pass',
  'seating staff pass kiosk authorization before token validation'
);

RESET ROLE;

-- Sofia is seeded with only the announcements permission.
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', current_setting('test.sofia_id'), 'role', 'authenticated')::text,
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
  jsonb_build_object('sub', current_setting('test.admin_id'), 'role', 'authenticated')::text,
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
