-- Keep financial and operational reservation records after a customer deletes
-- their account, while removing the relationship and personal identifiers.
alter table public.bookings
  alter column user_id drop not null;

alter table public.bookings
  drop constraint bookings_user_id_fkey;

alter table public.bookings
  add constraint bookings_user_id_fkey
  foreign key (user_id)
  references public.profiles (id)
  on delete set null;

-- The authenticated deletion function only needs to check whether an account
-- has an active reservation; retain all mutations behind the trigger below.
grant select on public.bookings to service_role;

create or replace function private.anonymize_customer_bookings_before_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.bookings
  set user_id = null,
      guest_name = 'Deleted account',
      guest_email = 'deleted+' || replace(id::text, '-', '') || '@jit-studyhub.invalid',
      updated_at = now()
  where user_id = old.id;

  return old;
end;
$$;

revoke execute on function private.anonymize_customer_bookings_before_profile_delete()
from public, anon, authenticated, service_role;

create trigger anonymize_customer_bookings_before_profile_delete
before delete on public.profiles
for each row
when (old.role = 'customer')
execute function private.anonymize_customer_bookings_before_profile_delete();

comment on function private.anonymize_customer_bookings_before_profile_delete() is
  'Trigger-only cleanup that anonymizes retained reservations when a customer profile is deleted.';
