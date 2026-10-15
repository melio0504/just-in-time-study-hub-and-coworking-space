alter table public.profiles
  add column username_changed_at timestamptz;

comment on column public.profiles.username_changed_at is
  'The most recent customer display-name change; used to enforce the 30-day cooldown.';

create or replace function private.enforce_customer_username_change_cooldown()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.full_name is not distinct from old.full_name or old.role <> 'customer' then
    return new;
  end if;

  if old.username_changed_at is not null
     and old.username_changed_at + interval '30 days' > now() then
    raise exception 'Username can only be changed once every 30 days'
      using errcode = 'P0001',
            detail = format(
              'The next username change is available at %s.',
              old.username_changed_at + interval '30 days'
            );
  end if;

  new.username_changed_at := now();
  return new;
end;
$$;

revoke execute on function private.enforce_customer_username_change_cooldown()
from public, anon, authenticated, service_role;

create trigger enforce_customer_username_change_cooldown
before update of full_name on public.profiles
for each row
execute function private.enforce_customer_username_change_cooldown();

comment on function private.enforce_customer_username_change_cooldown() is
  'Trigger-only enforcement for the 30-day customer display-name change cooldown.';
