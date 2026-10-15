-- Owner-managed staff account lifecycle support.

create index audit_logs_staff_login_history_idx
  on public.audit_logs (actor_id, created_at desc)
  where entity_type = 'admin_session';

create function public.revoke_staff_sessions(p_staff_id uuid) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revoked integer;
begin
  if not exists (
    select 1
    from public.profiles
    where id = p_staff_id
      and role = 'staff'
  ) then
    raise exception 'Staff account not found' using errcode = 'P0001';
  end if;

  delete from auth.sessions
  where user_id = p_staff_id;

  get diagnostics v_revoked = row_count;
  return v_revoked;
end;
$$;

revoke execute on function public.revoke_staff_sessions(uuid)
from public, anon, authenticated;
grant execute on function public.revoke_staff_sessions(uuid) to service_role;

comment on function public.revoke_staff_sessions(uuid) is
  'Revokes every refreshable Auth session for a staff account. Callable only by trusted server code after owner authorization.';
