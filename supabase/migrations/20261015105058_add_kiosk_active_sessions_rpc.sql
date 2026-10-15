create or replace function private.get_kiosk_active_sessions()
returns table (
  booking_id text,
  guest_name text,
  seats text[],
  checked_in_at timestamptz,
  scheduled_end timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.reservation_code,
    b.guest_name,
    b.seat_ids,
    cis.checked_in_at,
    cis.scheduled_end_at
  from public.check_in_sessions as cis
  join public.bookings as b on b.id = cis.booking_id
  where cis.status = 'checked_in'
  order by cis.checked_in_at desc;
$$;

create or replace function public.get_kiosk_active_sessions()
returns table (
  booking_id text,
  guest_name text,
  seats text[],
  checked_in_at timestamptz,
  scheduled_end timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.get_kiosk_active_sessions();
$$;

revoke execute on function private.get_kiosk_active_sessions()
  from public, anon, authenticated, service_role;
revoke execute on function public.get_kiosk_active_sessions()
  from public, anon, authenticated, service_role;

grant execute on function private.get_kiosk_active_sessions() to service_role;
grant execute on function public.get_kiosk_active_sessions() to service_role;

comment on function public.get_kiosk_active_sessions()
  is 'Returns active facility sessions to the device-authenticated kiosk Edge Function.';
