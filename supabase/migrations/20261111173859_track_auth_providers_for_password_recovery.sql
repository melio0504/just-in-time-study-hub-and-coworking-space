alter table public.profiles
  add column auth_providers text[] not null default '{}'::text[];

comment on column public.profiles.auth_providers is
  'Server-synchronized Supabase Auth providers used for trusted account recovery decisions.';

create index profiles_email_lookup_idx
  on public.profiles (email)
  where email is not null;

create function private.extract_auth_providers(p_app_metadata jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(coalesce(p_app_metadata, '{}'::jsonb) -> 'providers') = 'array' then
      coalesce(
        array(
          select distinct provider
          from jsonb_array_elements_text(p_app_metadata -> 'providers') as provider
          where provider <> ''
          order by provider
        ),
        '{}'::text[]
      )
    when nullif(coalesce(p_app_metadata, '{}'::jsonb) ->> 'provider', '') is not null then
      array[p_app_metadata ->> 'provider']
    else '{}'::text[]
  end;
$$;

revoke all on function private.extract_auth_providers(jsonb) from public, anon, authenticated;

update public.profiles as profile
set auth_providers = private.extract_auth_providers(auth_user.raw_app_meta_data)
from auth.users as auth_user
where auth_user.id = profile.id;

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, phone, email, auth_providers)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    nullif(left(coalesce(new.raw_user_meta_data ->> 'phone', ''), 32), ''),
    lower(new.email),
    private.extract_auth_providers(new.raw_app_meta_data)
  );
  return new;
end;
$$;

create function private.sync_profile_auth_providers() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles
  set auth_providers = private.extract_auth_providers(new.raw_app_meta_data)
  where id = new.id;
  return new;
end;
$$;

revoke all on function private.sync_profile_auth_providers() from public, anon, authenticated;

create trigger on_auth_user_providers_changed
after update of raw_app_meta_data on auth.users
for each row
when (new.raw_app_meta_data is distinct from old.raw_app_meta_data)
execute function private.sync_profile_auth_providers();
