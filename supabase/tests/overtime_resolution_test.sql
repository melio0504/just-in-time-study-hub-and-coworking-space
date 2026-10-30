begin;
select plan(25);

select has_type('public', 'overtime_resolution', 'overtime resolution type exists');
select enum_has_labels(
  'public',
  'overtime_resolution',
  array['paid_manually', 'waived'],
  'overtime resolutions are limited to paid manually or waived'
);
select has_column('public', 'check_in_sessions', 'overtime_resolution', 'sessions store the resolution');
select has_column('public', 'check_in_sessions', 'overtime_resolved_at', 'sessions store when overtime was resolved');
select has_column('public', 'check_in_sessions', 'overtime_resolved_by', 'sessions store who resolved overtime');
select has_function(
  'public',
  'resolve_overtime_session',
  array['uuid', 'public.overtime_resolution'],
  'the staff overtime resolution function exists'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.resolve_overtime_session(uuid, public.overtime_resolution)',
    'execute'
  ),
  'anonymous users cannot resolve overtime sessions'
);

-- Prepare these rows as non-demo fixtures so the scheduled demo checkout job
-- cannot consume them while this test exercises the staff resolution flow.
update public.bookings
set
  reservation_code = case id
    when 'a1000000-0000-4000-8000-000000000003' then 'JIT-TEST-OVERTIME-003'
    when 'a1000000-0000-4000-8000-000000000023' then 'JIT-TEST-OVERTIME-023'
    when 'a1000000-0000-4000-8000-000000000024' then 'JIT-TEST-OVERTIME-024'
  end,
  status = 'checked_in'
where id in (
  'a1000000-0000-4000-8000-000000000003',
  'a1000000-0000-4000-8000-000000000023',
  'a1000000-0000-4000-8000-000000000024'
);

update public.booking_seats
set active = true
where booking_id in (
  'a1000000-0000-4000-8000-000000000003',
  'a1000000-0000-4000-8000-000000000023',
  'a1000000-0000-4000-8000-000000000024'
);

update public.qr_access_passes
set revoked_at = null
where booking_id in (
  'a1000000-0000-4000-8000-000000000003',
  'a1000000-0000-4000-8000-000000000023',
  'a1000000-0000-4000-8000-000000000024'
);

update public.check_in_sessions
set
  status = 'overtime',
  checked_out_at = null,
  overtime_minutes = 65,
  overtime_charge_cents = 2460000,
  overtime_resolution = null,
  overtime_resolved_at = null,
  overtime_resolved_by = null
where booking_id = 'a1000000-0000-4000-8000-000000000003';

update public.check_in_sessions
set
  status = 'overtime',
  checked_out_at = null,
  overtime_minutes = 70,
  overtime_charge_cents = 820000,
  overtime_resolution = null,
  overtime_resolved_at = null,
  overtime_resolved_by = null
where booking_id = 'a1000000-0000-4000-8000-000000000024';

update public.check_in_sessions
set
  status = 'overtime',
  checked_out_at = null,
  overtime_minutes = 75,
  overtime_charge_cents = 815000,
  overtime_resolution = null,
  overtime_resolved_at = null,
  overtime_resolved_by = null
where booking_id = 'a1000000-0000-4000-8000-000000000023';

update public.seats
set status = 'occupied'
where code in ('HC13', 'HC14', 'HC15', 'SO12', 'GS06');

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
  $$ select public.resolve_overtime_session(
    'a1000000-0000-4000-8000-000000000023',
    'waived'
  ) $$,
  '42501',
  null,
  'customers cannot resolve an overtime session'
);
reset role;

select is(
  (select status::text from public.check_in_sessions where booking_id = 'a1000000-0000-4000-8000-000000000023'),
  'overtime',
  'a rejected resolution leaves the overtime session active'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select id from public.profiles where email = 'andrea.lim@jit-studyhub.com'),
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select throws_ok(
  $$ select public.resolve_overtime_session(
    'a1000000-0000-4000-8000-000000000003',
    null
  ) $$,
  '22023',
  null,
  'staff must choose a payment or waiver resolution'
);
select lives_ok(
  $$ select public.resolve_overtime_session(
    'a1000000-0000-4000-8000-000000000003',
    'paid_manually'
  ) $$,
  'staff can record a manual overtime payment'
);
reset role;

select is(
  (select status::text from public.bookings where id = 'a1000000-0000-4000-8000-000000000003'),
  'completed',
  'manual payment completes the reservation'
);
select is(
  (select status::text from public.check_in_sessions where booking_id = 'a1000000-0000-4000-8000-000000000003'),
  'checked_out',
  'manual payment closes the check-in session'
);
select is(
  (select overtime_resolution::text from public.check_in_sessions where booking_id = 'a1000000-0000-4000-8000-000000000003'),
  'paid_manually',
  'the manual payment resolution is retained'
);
select ok(
  (select overtime_resolved_at is not null from public.check_in_sessions where booking_id = 'a1000000-0000-4000-8000-000000000003'),
  'the resolution time is retained'
);
select is(
  (select overtime_resolved_by from public.check_in_sessions where booking_id = 'a1000000-0000-4000-8000-000000000003'),
  (select id from public.profiles where email = 'andrea.lim@jit-studyhub.com'),
  'the resolving staff member is retained'
);
select ok(
  not exists (
    select 1 from public.booking_seats
    where booking_id = 'a1000000-0000-4000-8000-000000000003' and active
  ),
  'resolved reservations no longer hold their seats'
);
select is(
  (select count(*) from public.seats where code in ('HC13', 'HC14', 'HC15') and status = 'available'),
  3::bigint,
  'every seat from the resolved reservation is released'
);
select ok(
  (select revoked_at is not null from public.qr_access_passes where booking_id = 'a1000000-0000-4000-8000-000000000003'),
  'the resolved reservation QR pass is revoked'
);
select ok(
  exists (
    select 1
    from public.audit_logs
    where entity_id = 'a1000000-0000-4000-8000-000000000003'
      and action = 'Recorded manual overtime payment'
      and details ->> 'resolution' = 'paid_manually'
  ),
  'manual payment writes an audit log'
);

set local role authenticated;
select lives_ok(
  $$ select public.resolve_overtime_session(
    'a1000000-0000-4000-8000-000000000024',
    'waived'
  ) $$,
  'staff can remove an overtime session without payment'
);
reset role;

select is(
  (select overtime_resolution::text from public.check_in_sessions where booking_id = 'a1000000-0000-4000-8000-000000000024'),
  'waived',
  'removing without payment records a waived resolution'
);
select is(
  (select status::text from public.bookings where id = 'a1000000-0000-4000-8000-000000000024'),
  'completed',
  'removing without payment completes the reservation'
);
select ok(
  exists (
    select 1
    from public.audit_logs
    where entity_id = 'a1000000-0000-4000-8000-000000000024'
      and action = 'Removed overtime charge without payment'
      and details ->> 'resolution' = 'waived'
  ),
  'removing without payment writes an audit log'
);

set local role authenticated;
select throws_ok(
  $$ select public.resolve_overtime_session(
    'a1000000-0000-4000-8000-000000000024',
    'waived'
  ) $$,
  'P0001',
  null,
  'an already resolved overtime session cannot be resolved twice'
);
reset role;

select * from finish();
rollback;
