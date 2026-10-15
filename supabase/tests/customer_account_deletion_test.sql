begin;
select plan(13);

select ok(
  has_table_privilege('service_role', 'public.bookings', 'SELECT'),
  'the account deletion service can check active reservations'
);

select set_config('test.customer_id', (
  select id::text
  from public.profiles
  where email = 'maria.santos.jit@gmail.com'
), true);

select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', current_setting('test.customer_id'), 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select results_eq(
  format($sql$
    update public.profiles
    set full_name = 'Maria Updated'
    where id = %L::uuid
    returning full_name
  $sql$, current_setting('test.customer_id')),
  $$ values ('Maria Updated'::text) $$,
  'a customer can change their own display name'
);

select is(
  (select full_name from public.profiles where id = current_setting('test.customer_id')::uuid),
  'Maria Updated',
  'the updated display name is visible through the customer RLS policy'
);

select ok(
  (select username_changed_at is not null from public.profiles where id = current_setting('test.customer_id')::uuid),
  'the first username change starts the cooldown'
);

select throws_ok(
  format(
    'update public.profiles set full_name = %L where id = %L::uuid',
    'Maria Changed Again',
    current_setting('test.customer_id')
  ),
  'P0001',
  'Username can only be changed once every 30 days',
  'a second username change during the cooldown is rejected'
);

reset role;

update public.profiles
set username_changed_at = now() - interval '31 days'
where id = current_setting('test.customer_id')::uuid;

select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', current_setting('test.customer_id'), 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select results_eq(
  format($sql$
    update public.profiles
    set full_name = 'Maria Eligible Again'
    where id = %L::uuid
    returning full_name
  $sql$, current_setting('test.customer_id')),
  $$ values ('Maria Eligible Again'::text) $$,
  'the username can be changed after the 30-day cooldown'
);

reset role;

select lives_ok(
  format(
    'delete from auth.users where id = %L::uuid',
    current_setting('test.customer_id')
  ),
  'a customer with retained reservation history can be deleted'
);

select is(
  (select count(*) from auth.users where id = current_setting('test.customer_id')::uuid),
  0::bigint,
  'the authentication account is deleted'
);

select is(
  (select count(*) from public.profiles where id = current_setting('test.customer_id')::uuid),
  0::bigint,
  'the customer profile is deleted by the auth cascade'
);

select is(
  (select count(*) from public.bookings where reservation_code = 'JIT-DEMO-001'),
  1::bigint,
  'the reservation record is retained'
);

select is(
  (select user_id from public.bookings where reservation_code = 'JIT-DEMO-001'),
  null::uuid,
  'the retained reservation is unlinked from the deleted profile'
);

select is(
  (select guest_name from public.bookings where reservation_code = 'JIT-DEMO-001'),
  'Deleted account',
  'the retained reservation name is anonymized'
);

select matches(
  (select guest_email from public.bookings where reservation_code = 'JIT-DEMO-001'),
  '^deleted\+[0-9a-f]{32}@jit-studyhub\.invalid$',
  'the retained reservation email is replaced with a non-deliverable identifier'
);

select * from finish();
rollback;
