create or replace function private.sync_booking_account_email(
  p_booking_id uuid,
  p_user_id uuid
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  select lower(u.email) into v_email
  from auth.users u
  where u.id = p_user_id and u.email is not null;

  if v_email is null then
    raise exception 'The account email could not be verified' using errcode = '42501';
  end if;

  update public.bookings
  set guest_email = v_email
  where id = p_booking_id
    and user_id = p_user_id
    and status = 'pending';

  if not found then
    raise exception 'Booking not found or no longer pending' using errcode = 'P0002';
  end if;

  return v_email;
end;
$$;

create or replace function public.sync_booking_account_email(
  p_booking_id uuid,
  p_user_id uuid
) returns text
language sql
security invoker
set search_path = ''
as $$
  select private.sync_booking_account_email(p_booking_id, p_user_id);
$$;

revoke execute on function private.sync_booking_account_email(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke execute on function public.sync_booking_account_email(uuid, uuid)
  from public, anon, authenticated;

grant execute on function private.sync_booking_account_email(uuid, uuid) to service_role;
grant execute on function public.sync_booking_account_email(uuid, uuid) to service_role;

comment on function public.sync_booking_account_email(uuid, uuid) is
  'Server-only synchronization of a pending booking destination with the verified Auth account email.';
