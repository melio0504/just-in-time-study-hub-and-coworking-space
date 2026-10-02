BEGIN;
SELECT plan(30);

SELECT has_table('public', 'profiles', 'profiles table exists');
SELECT has_table('public', 'seats', 'seats table exists');
SELECT has_table('public', 'bookings', 'bookings table exists');
SELECT has_table('public', 'payments', 'payments table exists');
SELECT has_table('public', 'qr_access_passes', 'QR access pass table exists');
SELECT has_table('public', 'check_in_sessions', 'check-in session table exists');
SELECT has_table('public', 'walk_in_occupancies', 'walk-in occupancy table exists');
SELECT has_table('public', 'daily_business_metrics', 'analytics metrics table exists');
SELECT has_function('public', 'create_booking', ARRAY['text', 'text', 'date', 'time without time zone', 'smallint', 'text', 'text[]'], 'booking RPC exists');
SELECT has_function('public', 'toggle_walk_in_occupancy', ARRAY['text', 'text'], 'walk-in toggle RPC exists');
SELECT has_function('public', 'admin_cancel_booking', ARRAY['uuid', 'text'], 'admin cancellation RPC exists');
SELECT has_function('public', 'log_admin_access', ARRAY['text'], 'admin access audit RPC exists');

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
SELECT ok(NOT has_table_privilege('anon', 'public.daily_business_metrics', 'select'), 'business metrics are not public');
SELECT ok(has_table_privilege('authenticated', 'public.daily_business_metrics', 'select'), 'staff role can be authorized to read business metrics');
SELECT has_column('public', 'profiles', 'staff_permissions', 'profiles store employee permission scopes');
SELECT has_column('public', 'profiles', 'must_change_password', 'profiles store the first-login password requirement');
SELECT is(
  (SELECT enum_range(NULL::public.staff_permission)::text),
  '{seating,reservations,announcements}',
  'staff permission scopes are constrained by an enum'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'profiles_single_admin_idx'),
  'the database permits only one admin role account'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_staff_permissions_required'),
  'staff accounts require at least one permission'
);
SELECT has_function('private', 'is_admin', ARRAY[]::text[], 'owner access helper exists');
SELECT has_function('private', 'has_staff_permission', ARRAY['public.staff_permission'], 'scoped staff access helper exists');
SELECT ok(
  has_table_privilege('service_role', 'public.profiles', 'select')
    AND has_table_privilege('service_role', 'public.profiles', 'update')
    AND has_table_privilege('service_role', 'public.audit_logs', 'insert'),
  'account creation service has only its required table operations'
);

SELECT * FROM finish();
ROLLBACK;
