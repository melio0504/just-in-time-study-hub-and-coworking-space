create or replace function private.update_seat_type_rate(
  p_seat_type text,
  p_hourly_rate_cents bigint
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_updated integer;
begin
  if v_actor is null or not private.has_staff_permission('announcements') then
    raise exception 'Content management access required' using errcode = '42501';
  end if;
  if p_seat_type is null or btrim(p_seat_type) = '' then
    raise exception 'Seat type is required' using errcode = '22023';
  end if;
  if p_hourly_rate_cents is null or p_hourly_rate_cents < 0 then
    raise exception 'Seat rate must be zero or greater' using errcode = '22023';
  end if;

  update public.seats
  set hourly_rate_cents = p_hourly_rate_cents,
      updated_at = now()
  where seat_type = p_seat_type;
  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    raise exception 'Seat type not found' using errcode = 'P0002';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (
    v_actor,
    'update_rate',
    'seat_type',
    p_seat_type,
    jsonb_build_object('hourly_rate_cents', p_hourly_rate_cents, 'seats_updated', v_updated)
  );

  return v_updated;
end;
$$;

revoke all on function private.update_seat_type_rate(text, bigint)
from public, anon, authenticated, service_role;
grant execute on function private.update_seat_type_rate(text, bigint)
to authenticated;

create or replace function public.update_seat_type_rate(
  p_seat_type text,
  p_hourly_rate_cents bigint
)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select private.update_seat_type_rate(p_seat_type, p_hourly_rate_cents);
$$;

revoke all on function public.update_seat_type_rate(text, bigint)
from public, anon, authenticated, service_role;
grant execute on function public.update_seat_type_rate(text, bigint)
to authenticated;

comment on function private.update_seat_type_rate(text, bigint) is
  'Privileged seat-category rate update with staff authorization and audit logging.';
comment on function public.update_seat_type_rate(text, bigint) is
  'Invoker RPC wrapper for the private, staff-authorized seat-rate update.';
