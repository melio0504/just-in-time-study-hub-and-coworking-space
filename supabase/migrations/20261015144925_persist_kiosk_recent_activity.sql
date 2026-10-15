create index if not exists check_in_sessions_checked_in_at_idx
  on public.check_in_sessions (checked_in_at desc);

create index if not exists check_in_sessions_checked_out_at_idx
  on public.check_in_sessions (checked_out_at desc)
  where checked_out_at is not null;

create or replace function private.get_kiosk_recent_activity()
returns table (
  activity_id text,
  activity_type text,
  booking_id text,
  guest_name text,
  seats text[],
  occurred_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    activity.activity_id,
    activity.activity_type,
    activity.booking_id,
    activity.guest_name,
    activity.seats,
    activity.occurred_at
  from (
    (
      select
        cis.id::text || ':check-in' as activity_id,
        'check-in'::text as activity_type,
        b.reservation_code as booking_id,
        b.guest_name,
        b.seat_ids as seats,
        cis.checked_in_at as occurred_at
      from public.check_in_sessions as cis
      join public.bookings as b on b.id = cis.booking_id
      order by cis.checked_in_at desc
      limit 12
    )
    union all
    (
      select
        cis.id::text || ':check-out' as activity_id,
        'check-out'::text as activity_type,
        b.reservation_code as booking_id,
        b.guest_name,
        b.seat_ids as seats,
        cis.checked_out_at as occurred_at
      from public.check_in_sessions as cis
      join public.bookings as b on b.id = cis.booking_id
      where cis.checked_out_at is not null
      order by cis.checked_out_at desc
      limit 12
    )
  ) as activity
  order by activity.occurred_at desc
  limit 12;
$$;

create or replace function public.get_kiosk_recent_activity()
returns table (
  activity_id text,
  activity_type text,
  booking_id text,
  guest_name text,
  seats text[],
  occurred_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.get_kiosk_recent_activity();
$$;

revoke execute on function private.get_kiosk_recent_activity()
  from public, anon, authenticated, service_role;
revoke execute on function public.get_kiosk_recent_activity()
  from public, anon, authenticated, service_role;

grant execute on function private.get_kiosk_recent_activity() to service_role;
grant execute on function public.get_kiosk_recent_activity() to service_role;

comment on function public.get_kiosk_recent_activity()
  is 'Returns the latest persisted check-in and check-out events to the device-authenticated kiosk Edge Function.';
