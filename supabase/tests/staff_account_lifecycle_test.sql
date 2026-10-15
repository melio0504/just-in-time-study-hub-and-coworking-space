BEGIN;
SELECT plan(4);

SELECT set_config(
  'test.staff_id',
  (SELECT id::text FROM public.profiles WHERE role = 'staff' ORDER BY created_at LIMIT 1),
  true
);

INSERT INTO auth.sessions (id, user_id, created_at, updated_at)
VALUES (
  'f1000000-0000-4000-8000-000000000001',
  current_setting('test.staff_id')::uuid,
  now(),
  now()
);

SELECT is(
  (SELECT count(*) FROM auth.sessions WHERE user_id = current_setting('test.staff_id')::uuid),
  1::bigint,
  'the test employee starts with one Auth session'
);

SET LOCAL ROLE service_role;

SELECT is(
  public.revoke_staff_sessions(current_setting('test.staff_id')::uuid),
  1,
  'trusted server code revokes every employee session'
);

RESET ROLE;

SELECT is(
  (SELECT count(*) FROM auth.sessions WHERE user_id = current_setting('test.staff_id')::uuid),
  0::bigint,
  'revoked employee sessions are removed from Auth'
);

SELECT throws_ok(
  $$ SELECT public.revoke_staff_sessions('f2000000-0000-4000-8000-000000000001') $$,
  'P0001',
  'Staff account not found',
  'session revocation rejects non-staff account IDs'
);

SELECT * FROM finish();
ROLLBACK;
