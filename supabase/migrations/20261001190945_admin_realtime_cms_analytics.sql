-- Admin operations, live seat occupancy, CMS, and database-backed analytics.

alter table public.profiles
  add column email text;

update public.profiles as profile
set email = lower(auth_user.email)
from auth.users as auth_user
where auth_user.id = profile.id;

alter table public.profiles
  add constraint profiles_email_format check (
    email is null or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  );

create unique index profiles_email_unique_idx
  on public.profiles (lower(email))
  where email is not null;

create table public.walk_in_occupancies (
  id uuid primary key default gen_random_uuid(),
  seat_id uuid not null references public.seats (id) on delete restrict,
  guest_name text check (guest_name is null or char_length(guest_name) between 1 and 120),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_by uuid not null references public.profiles (id) on delete restrict,
  ended_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint walk_in_occupancies_valid_window check (ended_at is null or ended_at >= started_at)
);

create unique index walk_in_occupancies_one_active_per_seat_idx
  on public.walk_in_occupancies (seat_id)
  where ended_at is null;
create index walk_in_occupancies_started_at_idx
  on public.walk_in_occupancies (started_at desc);

create table public.daily_business_metrics (
  metric_date date primary key,
  revenue_cents bigint not null default 0 check (revenue_cents >= 0),
  bookings_count integer not null default 0 check (bookings_count >= 0),
  checkins_count integer not null default 0 check (checkins_count >= 0),
  occupied_seat_hours numeric(10, 2) not null default 0 check (occupied_seat_hours >= 0),
  available_seat_hours numeric(10, 2) not null default 600 check (available_seat_hours > 0),
  active_members integer not null default 0 check (active_members >= 0),
  hourly_revenue_cents bigint not null default 0 check (hourly_revenue_cents >= 0),
  daily_pass_revenue_cents bigint not null default 0 check (daily_pass_revenue_cents >= 0),
  monthly_revenue_cents bigint not null default 0 check (monthly_revenue_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index daily_business_metrics_date_desc_idx
  on public.daily_business_metrics (metric_date desc);

create trigger daily_business_metrics_set_updated_at
before update on public.daily_business_metrics
for each row execute function private.set_updated_at();

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, phone, email)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    nullif(left(coalesce(new.raw_user_meta_data ->> 'phone', ''), 32), ''),
    lower(new.email)
  );
  return new;
end;
$$;

create function private.toggle_walk_in_occupancy(
  p_seat_code text,
  p_guest_name text default null
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_seat_id uuid;
  v_occupancy_id uuid;
begin
  if v_actor is null or not private.is_admin() then
    raise exception 'Staff access required' using errcode = '42501';
  end if;

  select id into v_seat_id
  from public.seats
  where code = upper(btrim(p_seat_code)) and is_active
  for update;

  if v_seat_id is null then
    raise exception 'Seat not found' using errcode = 'P0001';
  end if;

  select id into v_occupancy_id
  from public.walk_in_occupancies
  where seat_id = v_seat_id and ended_at is null
  for update;

  if v_occupancy_id is not null then
    update public.walk_in_occupancies
    set ended_at = now(), ended_by = v_actor
    where id = v_occupancy_id;

    insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
    values (v_actor, 'Walk-in checked out', 'seat', p_seat_code, jsonb_build_object('occupancy_id', v_occupancy_id));
    return false;
  end if;

  insert into public.walk_in_occupancies (seat_id, guest_name, created_by)
  values (v_seat_id, nullif(btrim(p_guest_name), ''), v_actor)
  returning id into v_occupancy_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (v_actor, 'Walk-in checked in', 'seat', p_seat_code, jsonb_build_object('occupancy_id', v_occupancy_id));
  return true;
end;
$$;

create function public.toggle_walk_in_occupancy(
  p_seat_code text,
  p_guest_name text default null
) returns boolean
language sql security invoker set search_path = '' as $$
  select private.toggle_walk_in_occupancy(p_seat_code, p_guest_name);
$$;

create function private.log_admin_access(p_action text default 'Signed in') returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null or not private.is_admin() then
    raise exception 'Staff access required' using errcode = '42501';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id)
  values (v_actor, left(coalesce(nullif(btrim(p_action), ''), 'Signed in'), 120), 'admin_session', v_actor::text);
end;
$$;

create function public.log_admin_access(p_action text default 'Signed in') returns void
language sql security invoker set search_path = '' as $$
  select private.log_admin_access(p_action);
$$;

create function private.admin_cancel_booking(p_booking_id uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null or not private.is_admin() then
    raise exception 'Staff access required' using errcode = '42501';
  end if;

  update public.bookings
  set status = 'cancelled',
      cancelled_at = now(),
      cancellation_reason = coalesce(nullif(btrim(p_reason), ''), 'Cancelled by staff')
  where id = p_booking_id
    and status not in ('cancelled', 'completed', 'declined', 'no_show');

  if not found then
    raise exception 'Booking cannot be cancelled' using errcode = 'P0001';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (v_actor, 'Cancelled reservation', 'booking', p_booking_id::text,
    jsonb_build_object('reason', coalesce(nullif(btrim(p_reason), ''), 'Cancelled by staff')));
end;
$$;

create function public.admin_cancel_booking(p_booking_id uuid, p_reason text default null) returns void
language sql security invoker set search_path = '' as $$
  select private.admin_cancel_booking(p_booking_id, p_reason);
$$;

alter table public.walk_in_occupancies enable row level security;
alter table public.daily_business_metrics enable row level security;

revoke all on table public.walk_in_occupancies, public.daily_business_metrics from anon, authenticated;
grant select on table public.walk_in_occupancies, public.daily_business_metrics to authenticated;

create policy "Staff read walk-in occupancies"
on public.walk_in_occupancies for select to authenticated
using ((select private.is_admin()));

create policy "Staff read business metrics"
on public.daily_business_metrics for select to authenticated
using ((select private.is_admin()));

revoke execute on function public.toggle_walk_in_occupancy(text, text) from public, anon;
revoke execute on function public.log_admin_access(text) from public, anon;
revoke execute on function public.admin_cancel_booking(uuid, text) from public, anon;
revoke execute on function private.toggle_walk_in_occupancy(text, text) from public, anon, authenticated, service_role;
revoke execute on function private.log_admin_access(text) from public, anon, authenticated, service_role;
revoke execute on function private.admin_cancel_booking(uuid, text) from public, anon, authenticated, service_role;
grant execute on function private.toggle_walk_in_occupancy(text, text) to authenticated;
grant execute on function private.log_admin_access(text) to authenticated;
grant execute on function private.admin_cancel_booking(uuid, text) to authenticated;
grant execute on function public.toggle_walk_in_occupancy(text, text) to authenticated;
grant execute on function public.log_admin_access(text) to authenticated;
grant execute on function public.admin_cancel_booking(uuid, text) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bookings'
  ) then
    alter publication supabase_realtime add table public.bookings;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'walk_in_occupancies'
  ) then
    alter publication supabase_realtime add table public.walk_in_occupancies;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'announcements'
  ) then
    alter publication supabase_realtime add table public.announcements;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'audit_logs'
  ) then
    alter publication supabase_realtime add table public.audit_logs;
  end if;
end
$$;
