BEGIN;
SELECT plan(15);

SELECT has_table('public', 'profiles', 'profiles table exists');
SELECT has_table('public', 'seats', 'seats table exists');
SELECT has_table('public', 'bookings', 'bookings table exists');
SELECT has_table('public', 'payments', 'payments table exists');
SELECT has_table('public', 'qr_access_passes', 'QR access pass table exists');
SELECT has_table('public', 'check_in_sessions', 'check-in session table exists');
SELECT has_function('public', 'create_booking', ARRAY['text', 'text', 'date', 'time without time zone', 'smallint', 'text', 'text[]'], 'booking RPC exists');

SELECT is(
  (SELECT count(*)::integer FROM public.seats),
  50,
  'all 50 facility seats are provisioned'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND NOT c.relrowsecurity
  ),
  0,
  'RLS is enabled on every public table'
);

SELECT ok(has_table_privilege('anon', 'public.seats', 'select'), 'anonymous visitors can read active seats');
SELECT ok(NOT has_table_privilege('anon', 'public.profiles', 'select'), 'anonymous visitors cannot read profiles');
SELECT ok(NOT has_table_privilege('authenticated', 'public.bookings', 'insert'), 'bookings cannot bypass the atomic RPC');
SELECT ok(has_function_privilege('authenticated', 'public.create_booking(text,text,date,time without time zone,smallint,text,text[])', 'execute'), 'authenticated users can call booking RPC');
SELECT ok(has_schema_privilege('authenticated', 'private', 'usage'), 'authenticated RPC wrappers can enter the private schema');
SELECT ok(NOT has_table_privilege('authenticated', 'public.payment_webhook_events', 'select'), 'payment webhook payloads are server-only');

SELECT * FROM finish();
ROLLBACK;
