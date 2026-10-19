BEGIN;
SELECT plan(20);

INSERT INTO public.seats (
  code,
  name,
  zone,
  seat_type,
  hourly_rate_cents
) VALUES (
  'WI99',
  'Walk-in service test seat',
  'Test zone',
  'individual',
  8000
);

SELECT set_config(
  'test.business_date',
  ((((now() AT TIME ZONE 'Asia/Manila') - interval '8 hours')::date)::text),
  true
);
-- Keep the 90-minute manual session in the past even when CI runs just after
-- the 8 AM cutoff, and cover both its date and today's live sessions.
SELECT set_config(
  'test.report_start_date',
  ((current_setting('test.business_date')::date - 1)::text),
  true
);
SELECT set_config('test.admin_id', (SELECT id::text FROM public.profiles WHERE email = 'admin@jit-studyhub.com'), true);
SELECT set_config('test.maria_id', (SELECT id::text FROM public.profiles WHERE email = 'maria.santos.jit@gmail.com'), true);
SELECT set_config('test.ramon_id', (SELECT id::text FROM public.profiles WHERE email = 'ramon.deleon@jit-studyhub.com'), true);
SELECT set_config(
  'test.public_rate_count',
  (
    SELECT count(*)::text
    FROM public.service_rate_plans
    WHERE is_active
      AND effective_from <= current_date
      AND (effective_until IS NULL OR effective_until >= current_date)
  ),
  true
);

-- Capture the existing seeded totals so these tests remain deterministic.
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', current_setting('test.admin_id'), 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
SELECT set_config(
  'test.baseline_count',
  (
    SELECT coalesce(sum(walk_in_count), 0)::bigint::text
    FROM public.get_business_report(
      current_setting('test.report_start_date')::date,
      current_setting('test.business_date')::date
    )
  ),
  true
);
SELECT set_config(
  'test.baseline_revenue',
  (
    SELECT coalesce(sum(walk_in_revenue_cents), 0)::bigint::text
    FROM public.get_business_report(
      current_setting('test.report_start_date')::date,
      current_setting('test.business_date')::date
    )
  ),
  true
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', current_setting('test.maria_id'), 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$ SELECT public.start_walk_in('WI99', 'Unauthorized customer', NULL) $$,
  '42501',
  'Seating access required',
  'customers cannot start walk-in sessions'
);
SELECT is(
  (SELECT count(*) FROM public.service_rate_plans),
  current_setting('test.public_rate_count')::bigint,
  'customers can read current public pricing tiers'
);
SELECT throws_ok(
  format(
    'SELECT * FROM public.get_business_report(%L::date, %L::date)',
    current_setting('test.business_date'),
    current_setting('test.business_date')
  ),
  '42501',
  'Owner access required',
  'customers cannot read owner business reports'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', current_setting('test.ramon_id'), 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;

SELECT ok(
  (SELECT count(*) FROM public.service_rate_plans) >= 9,
  'seating staff can read the configured walk-in prices'
);
SELECT set_config(
  'test.first_walk_in',
  (SELECT public.start_walk_in('wi99', 'Live walk-in', 'Created by pgTAP')::text),
  true
);
SELECT is(
  (
    SELECT status
    FROM public.walk_in_occupancies
    WHERE id = current_setting('test.first_walk_in')::uuid
  ),
  'active',
  'starting a walk-in creates an active timed session'
);
SELECT is(
  (
    SELECT business_date
    FROM public.walk_in_occupancies
    WHERE id = current_setting('test.first_walk_in')::uuid
  ),
  current_setting('test.business_date')::date,
  'the walk-in uses the 8 AM Manila business-day cutoff'
);
SELECT lives_ok(
  format(
    'SELECT public.checkout_walk_in(%L::uuid, NULL, %L, %L, NULL, NULL)',
    current_setting('test.first_walk_in'),
    'cash',
    'paid'
  ),
  'seating staff can check out and collect a walk-in'
);
SELECT is(
  (
    SELECT service_name
    FROM public.walk_in_occupancies
    WHERE id = current_setting('test.first_walk_in')::uuid
  ),
  '1 hour',
  'checkout snapshots the matching service tier'
);
SELECT is(
  (
    SELECT charged_amount_cents
    FROM public.walk_in_occupancies
    WHERE id = current_setting('test.first_walk_in')::uuid
  ),
  8000::bigint,
  'checkout records the calculated list price'
);

SELECT set_config(
  'test.override_walk_in',
  (SELECT public.start_walk_in('wi99', 'Discounted walk-in', NULL)::text),
  true
);
SELECT throws_ok(
  format(
    'SELECT public.checkout_walk_in(%L::uuid, NULL, %L, %L, 7000, NULL)',
    current_setting('test.override_walk_in'),
    'gcash',
    'paid'
  ),
  '22023',
  'Explain why the listed price was changed',
  'a price override requires an audit reason'
);
SELECT lives_ok(
  format(
    'SELECT public.checkout_walk_in(%L::uuid, NULL, %L, %L, 7000, %L)',
    current_setting('test.override_walk_in'),
    'gcash',
    'paid',
    'Opening promotion'
  ),
  'a documented price override is accepted'
);
SELECT is(
  (
    SELECT price_override_reason
    FROM public.walk_in_occupancies
    WHERE id = current_setting('test.override_walk_in')::uuid
  ),
  'Opening promotion',
  'the price adjustment reason is retained'
);

SELECT set_config(
  'test.manual_walk_in',
  (
    SELECT public.create_completed_walk_in(
      'WI99',
      'Recovered walk-in',
      (current_setting('test.report_start_date')::date + time '10:00') AT TIME ZONE 'Asia/Manila',
      (current_setting('test.report_start_date')::date + time '11:30') AT TIME ZONE 'Asia/Manila',
      'qrph',
      'paid',
      11000,
      'Student discount',
      'Added after the shift'
    )::text
  ),
  true
);
SELECT is(
  (
    SELECT billable_minutes
    FROM public.walk_in_occupancies
    WHERE id = current_setting('test.manual_walk_in')::uuid
  ),
  90,
  'manual entry calculates the actual stay in minutes'
);
SELECT is(
  (
    SELECT payment_method
    FROM public.walk_in_occupancies
    WHERE id = current_setting('test.manual_walk_in')::uuid
  ),
  'qrph',
  'manual entry records the payment method'
);

SELECT throws_ok(
  format(
    'SELECT * FROM public.get_business_report(%L::date, %L::date)',
    current_setting('test.business_date'),
    current_setting('test.business_date')
  ),
  '42501',
  'Owner access required',
  'seating-only staff cannot read financial reports'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', current_setting('test.admin_id'), 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;

SELECT is(
  (
    SELECT coalesce(sum(walk_in_count), 0)::bigint
    FROM public.get_business_report(
      current_setting('test.report_start_date')::date,
      current_setting('test.business_date')::date
    )
  ),
  current_setting('test.baseline_count')::bigint + 3,
  'the owner report includes live and manually entered walk-ins'
);
SELECT is(
  (
    SELECT coalesce(sum(walk_in_revenue_cents), 0)::bigint
    FROM public.get_business_report(
      current_setting('test.report_start_date')::date,
      current_setting('test.business_date')::date
    )
  ),
  current_setting('test.baseline_revenue')::bigint + 26000,
  'the owner report sums paid walk-in revenue after adjustments'
);
SELECT lives_ok(
  format(
    'SELECT public.void_walk_in(%L::uuid, %L)',
    current_setting('test.first_walk_in'),
    'Duplicate record'
  ),
  'the owner can void an incorrect walk-in record'
);
SELECT is(
  (
    SELECT coalesce(sum(walk_in_revenue_cents), 0)::bigint
    FROM public.get_business_report(
      current_setting('test.report_start_date')::date,
      current_setting('test.business_date')::date
    )
  ),
  current_setting('test.baseline_revenue')::bigint + 18000,
  'voided walk-ins are removed from reported revenue'
);
SELECT is(
  (
    SELECT count(*)
    FROM public.audit_logs
    WHERE entity_type = 'walk_in'
      AND entity_id IN (
        current_setting('test.first_walk_in'),
        current_setting('test.override_walk_in'),
        current_setting('test.manual_walk_in')
      )
  ),
  7::bigint,
  'walk-in creation, checkout, manual entry, and void actions are audited'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
