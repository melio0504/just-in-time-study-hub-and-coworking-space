begin;
select plan(6);

select has_column(
  'public',
  'profiles',
  'auth_providers',
  'profiles track trusted Supabase Auth providers'
);

select is(
  (select auth_providers from public.profiles where email = 'maria.santos.jit@gmail.com'),
  array['email']::text[],
  'existing password accounts are backfilled with the email provider'
);

select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'auth_providers', 'UPDATE'),
  'signed-in users cannot rewrite their trusted authentication providers'
);

update auth.users
set raw_app_meta_data = jsonb_build_object('provider', 'google', 'providers', jsonb_build_array('google'))
where email = 'maria.santos.jit@gmail.com';

select is(
  (select auth_providers from public.profiles where email = 'maria.santos.jit@gmail.com'),
  array['google']::text[],
  'Google-only provider metadata is synchronized to the profile'
);

update auth.users
set raw_app_meta_data = jsonb_build_object(
  'provider', 'google',
  'providers', jsonb_build_array('google', 'email')
)
where email = 'maria.santos.jit@gmail.com';

select is(
  (select auth_providers from public.profiles where email = 'maria.santos.jit@gmail.com'),
  array['email', 'google']::text[],
  'linked password and Google providers are both synchronized'
);

select ok(
  not has_function_privilege(
    'anon',
    'private.extract_auth_providers(jsonb)',
    'execute'
  ),
  'anonymous callers cannot execute the provider extraction helper'
);

select * from finish();
rollback;
