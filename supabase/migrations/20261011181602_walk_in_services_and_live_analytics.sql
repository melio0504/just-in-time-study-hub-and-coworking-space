-- Billable walk-in sessions and owner-only live business reporting.

create table public.service_rate_plans (
  id bigint generated always as identity primary key,
  code text not null unique check (code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 80),
  category text not null default 'hourly'
    check (category in ('hourly', 'daily_pass', 'package', 'other')),
  min_minutes integer not null check (min_minutes > 0),
  max_minutes integer check (max_minutes is null or max_minutes >= min_minutes),
  price_cents bigint not null check (price_cents >= 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  effective_from date not null default current_date,
  effective_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_rate_plans_effective_window
    check (effective_until is null or effective_until >= effective_from)
);

create index service_rate_plans_active_duration_idx
  on public.service_rate_plans (min_minutes, max_minutes, sort_order)
  where is_active;

create trigger service_rate_plans_set_updated_at
before update on public.service_rate_plans
for each row execute function private.set_updated_at();

insert into public.service_rate_plans
  (code, name, min_minutes, max_minutes, price_cents, sort_order, effective_from)
values
  ('hour-1', '1 hour', 1, 60, 8000, 10, date '2000-01-01'),
  ('hours-2', '2 hours', 61, 120, 12000, 20, date '2000-01-01'),
  ('hours-3', '3 hours', 121, 180, 15000, 30, date '2000-01-01'),
  ('hours-4', '4 hours', 181, 240, 17000, 40, date '2000-01-01'),
  ('hours-5', '5 hours', 241, 300, 20000, 50, date '2000-01-01'),
  ('hours-6', '6 hours', 301, 360, 23000, 60, date '2000-01-01'),
  ('hours-7-8', '7–8 hours', 361, 480, 27000, 70, date '2000-01-01'),
  ('hours-9-10', '9–10 hours', 481, 600, 32000, 80, date '2000-01-01'),
  ('whole-day', 'Whole day', 601, null, 37000, 90, date '2000-01-01');

alter table public.walk_in_occupancies
  add column business_date date,
  add column status text not null default 'active',
  add column rate_plan_id bigint references public.service_rate_plans (id) on delete restrict,
  add column service_name text,
  add column billable_minutes integer,
  add column listed_price_cents bigint,
  add column charged_amount_cents bigint,
  add column payment_method text,
  add column payment_status text not null default 'unpaid',
  add column price_override_reason text,
  add column notes text,
  add column updated_at timestamptz not null default now();

update public.walk_in_occupancies
set business_date = (((started_at at time zone 'Asia/Manila') - interval '8 hours')::date),
    status = case when ended_at is null then 'active' else 'completed' end;

alter table public.walk_in_occupancies
  alter column business_date set not null,
  alter column business_date set default (((now() at time zone 'Asia/Manila') - interval '8 hours')::date),
  add constraint walk_in_occupancies_status_check
    check (status in ('active', 'completed', 'voided')),
  add constraint walk_in_occupancies_payment_status_check
    check (payment_status in ('unpaid', 'paid', 'refunded', 'voided')),
  add constraint walk_in_occupancies_payment_method_check
    check (payment_method is null or payment_method in ('cash', 'gcash', 'qrph', 'other')),
  add constraint walk_in_occupancies_billable_minutes_check
    check (billable_minutes is null or billable_minutes > 0),
  add constraint walk_in_occupancies_listed_price_check
    check (listed_price_cents is null or listed_price_cents >= 0),
  add constraint walk_in_occupancies_charged_amount_check
    check (charged_amount_cents is null or charged_amount_cents >= 0),
  add constraint walk_in_occupancies_status_window_check
    check (
      (status = 'active' and ended_at is null)
      or (status in ('completed', 'voided') and ended_at is not null)
    ),
  add constraint walk_in_occupancies_service_name_length
    check (service_name is null or char_length(service_name) between 1 and 80),
  add constraint walk_in_occupancies_override_reason_length
    check (price_override_reason is null or char_length(price_override_reason) between 1 and 500),
  add constraint walk_in_occupancies_notes_length
    check (notes is null or char_length(notes) <= 1000);

create index walk_in_occupancies_rate_plan_id_idx
  on public.walk_in_occupancies (rate_plan_id);
create index walk_in_occupancies_business_status_idx
  on public.walk_in_occupancies (business_date desc, status);
create index walk_in_occupancies_payment_status_idx
  on public.walk_in_occupancies (payment_status, business_date desc);
create index walk_in_occupancies_created_by_idx
  on public.walk_in_occupancies (created_by);
create index walk_in_occupancies_ended_by_idx
  on public.walk_in_occupancies (ended_by)
  where ended_by is not null;

create trigger walk_in_occupancies_set_updated_at
before update on public.walk_in_occupancies
for each row execute function private.set_updated_at();

alter table public.service_rate_plans enable row level security;
revoke all on table public.service_rate_plans from public, anon, authenticated;
grant select on table public.service_rate_plans to authenticated;

create policy "Operations staff read service rates"
on public.service_rate_plans for select to authenticated
using (
  (select private.has_staff_permission('seating'))
  or (select private.has_staff_permission('reservations'))
);

create function private.start_walk_in(
  p_seat_code text,
  p_guest_name text default null,
  p_notes text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_seat_id uuid;
  v_walk_in_id uuid;
  v_started_at timestamptz := now();
begin
  if v_actor is null or not private.has_staff_permission('seating') then
    raise exception 'Seating access required' using errcode = '42501';
  end if;

  select id into v_seat_id
  from public.seats
  where code = upper(btrim(p_seat_code)) and is_active and status <> 'maintenance'
  for update;

  if v_seat_id is null then
    raise exception 'Seat not found or unavailable' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.walk_in_occupancies
    where seat_id = v_seat_id and ended_at is null
  ) then
    raise exception 'This seat already has an active walk-in' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.bookings
    where status = 'checked_in' and upper(btrim(p_seat_code)) = any(seat_ids)
  ) then
    raise exception 'This seat is occupied by a checked-in reservation' using errcode = 'P0001';
  end if;

  insert into public.walk_in_occupancies (
    seat_id, guest_name, started_at, business_date, status, payment_status,
    notes, created_by
  ) values (
    v_seat_id,
    nullif(btrim(p_guest_name), ''),
    v_started_at,
    (((v_started_at at time zone 'Asia/Manila') - interval '8 hours')::date),
    'active',
    'unpaid',
    nullif(btrim(p_notes), ''),
    v_actor
  ) returning id into v_walk_in_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (
    v_actor,
    'Walk-in checked in',
    'walk_in',
    v_walk_in_id::text,
    jsonb_build_object('seat_code', upper(btrim(p_seat_code)))
  );

  return v_walk_in_id;
end;
$$;

create function private.checkout_walk_in(
  p_walk_in_id uuid,
  p_ended_at timestamptz default null,
  p_payment_method text default 'cash',
  p_payment_status text default 'paid',
  p_charged_amount_cents bigint default null,
  p_override_reason text default null
) returns public.walk_in_occupancies
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_walk_in public.walk_in_occupancies%rowtype;
  v_rate public.service_rate_plans%rowtype;
  v_ended_at timestamptz := coalesce(p_ended_at, now());
  v_minutes integer;
  v_charge bigint;
begin
  if v_actor is null or not private.has_staff_permission('seating') then
    raise exception 'Seating access required' using errcode = '42501';
  end if;
  if p_payment_method not in ('cash', 'gcash', 'qrph', 'other') then
    raise exception 'Choose a valid payment method' using errcode = '22023';
  end if;
  if p_payment_status not in ('paid', 'unpaid') then
    raise exception 'Payment status must be paid or unpaid' using errcode = '22023';
  end if;

  select * into v_walk_in
  from public.walk_in_occupancies
  where id = p_walk_in_id
  for update;

  if not found or v_walk_in.status <> 'active' then
    raise exception 'Active walk-in session not found' using errcode = 'P0001';
  end if;
  if v_ended_at < v_walk_in.started_at or v_ended_at > now() + interval '5 minutes' then
    raise exception 'Checkout time is invalid' using errcode = '22023';
  end if;

  v_minutes := greatest(1, ceil(extract(epoch from (v_ended_at - v_walk_in.started_at)) / 60.0)::integer);

  select * into v_rate
  from public.service_rate_plans
  where is_active
    and effective_from <= v_walk_in.business_date
    and (effective_until is null or effective_until >= v_walk_in.business_date)
    and min_minutes <= v_minutes
    and (max_minutes is null or max_minutes >= v_minutes)
  order by sort_order, min_minutes
  limit 1;

  if not found then
    raise exception 'No active service rate covers this duration' using errcode = 'P0001';
  end if;

  v_charge := coalesce(p_charged_amount_cents, v_rate.price_cents);
  if v_charge < 0 then
    raise exception 'Charged amount cannot be negative' using errcode = '22023';
  end if;
  if v_charge <> v_rate.price_cents and nullif(btrim(p_override_reason), '') is null then
    raise exception 'Explain why the listed price was changed' using errcode = '22023';
  end if;

  update public.walk_in_occupancies
  set ended_at = v_ended_at,
      ended_by = v_actor,
      status = 'completed',
      rate_plan_id = v_rate.id,
      service_name = v_rate.name,
      billable_minutes = v_minutes,
      listed_price_cents = v_rate.price_cents,
      charged_amount_cents = v_charge,
      payment_method = p_payment_method,
      payment_status = p_payment_status,
      price_override_reason = nullif(btrim(p_override_reason), '')
  where id = v_walk_in.id
  returning * into v_walk_in;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (
    v_actor,
    'Walk-in checked out',
    'walk_in',
    v_walk_in.id::text,
    jsonb_build_object(
      'billable_minutes', v_minutes,
      'listed_price_cents', v_rate.price_cents,
      'charged_amount_cents', v_charge,
      'payment_method', p_payment_method,
      'payment_status', p_payment_status,
      'override_reason', nullif(btrim(p_override_reason), '')
    )
  );

  return v_walk_in;
end;
$$;

create function private.create_completed_walk_in(
  p_seat_code text,
  p_guest_name text,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_payment_method text default 'cash',
  p_payment_status text default 'paid',
  p_charged_amount_cents bigint default null,
  p_override_reason text default null,
  p_notes text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_seat_id uuid;
  v_walk_in_id uuid;
begin
  if v_actor is null or not private.has_staff_permission('seating') then
    raise exception 'Seating access required' using errcode = '42501';
  end if;
  if p_started_at is null or p_ended_at is null or p_ended_at < p_started_at
     or p_ended_at > now() + interval '5 minutes' then
    raise exception 'Enter a valid completed session time' using errcode = '22023';
  end if;

  select id into v_seat_id
  from public.seats
  where code = upper(btrim(p_seat_code))
  for update;

  if v_seat_id is null then
    raise exception 'Seat not found' using errcode = 'P0001';
  end if;

  insert into public.walk_in_occupancies (
    seat_id, guest_name, started_at, business_date, status, payment_status,
    notes, created_by
  ) values (
    v_seat_id,
    nullif(btrim(p_guest_name), ''),
    p_started_at,
    (((p_started_at at time zone 'Asia/Manila') - interval '8 hours')::date),
    'active',
    'unpaid',
    nullif(btrim(p_notes), ''),
    v_actor
  ) returning id into v_walk_in_id;

  perform private.checkout_walk_in(
    v_walk_in_id,
    p_ended_at,
    p_payment_method,
    p_payment_status,
    p_charged_amount_cents,
    p_override_reason
  );

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (
    v_actor,
    'Added completed walk-in',
    'walk_in',
    v_walk_in_id::text,
    jsonb_build_object('seat_code', upper(btrim(p_seat_code)), 'manual_entry', true)
  );

  return v_walk_in_id;
end;
$$;

create function private.void_walk_in(
  p_walk_in_id uuid,
  p_reason text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null or not private.is_admin() then
    raise exception 'Owner access required' using errcode = '42501';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'A reason is required' using errcode = '22023';
  end if;

  update public.walk_in_occupancies
  set status = 'voided',
      ended_at = coalesce(ended_at, now()),
      ended_by = coalesce(ended_by, v_actor),
      payment_status = 'voided',
      price_override_reason = left(btrim(p_reason), 500)
  where id = p_walk_in_id and status <> 'voided';

  if not found then
    raise exception 'Walk-in session cannot be voided' using errcode = 'P0001';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (v_actor, 'Voided walk-in', 'walk_in', p_walk_in_id::text,
    jsonb_build_object('reason', left(btrim(p_reason), 500)));
end;
$$;

create function private.get_business_report(
  p_start_date date,
  p_end_date date
) returns table (
  report_date date,
  reservation_count bigint,
  walk_in_count bigint,
  total_visits bigint,
  reservation_revenue_cents bigint,
  walk_in_revenue_cents bigint,
  revenue_cents bigint,
  reservation_checkins bigint,
  walk_in_checkins bigint,
  checkins_count bigint,
  reservation_seat_hours numeric,
  walk_in_seat_hours numeric,
  occupied_seat_hours numeric,
  available_seat_hours numeric,
  outstanding_walk_in_cents bigint,
  cash_revenue_cents bigint,
  gcash_revenue_cents bigint,
  qrph_revenue_cents bigint,
  other_revenue_cents bigint
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not private.is_admin() then
    raise exception 'Owner access required' using errcode = '42501';
  end if;
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date
     or p_end_date - p_start_date > 370 then
    raise exception 'Report range must be between 1 and 371 days' using errcode = '22023';
  end if;

  return query
  with dates as (
    select day::date as report_date
    from generate_series(p_start_date, p_end_date, interval '1 day') as day
  ),
  reservation_metrics as (
    select
      booking_date as report_date,
      count(*) filter (where status in ('confirmed', 'checked_in', 'completed'))::bigint as reservation_count,
      coalesce(sum(subtotal_cents) filter (
        where status in ('confirmed', 'checked_in', 'completed')
          and payment_status not in ('failed', 'refunded')
      ), 0)::bigint as reservation_revenue_cents
    from public.bookings
    where booking_date between p_start_date and p_end_date
    group by booking_date
  ),
  reservation_usage as (
    select
      (((session.checked_in_at at time zone 'Asia/Manila') - interval '8 hours')::date) as report_date,
      count(*) filter (where session.status <> 'no_show')::bigint as reservation_checkins,
      coalesce(sum(
        greatest(0, extract(epoch from (
          coalesce(session.checked_out_at, least(now(), session.scheduled_end_at)) - session.checked_in_at
        )) / 3600.0) * cardinality(booking.seat_ids)
      ) filter (where session.status <> 'no_show'), 0)::numeric(12, 2) as reservation_seat_hours
    from public.check_in_sessions as session
    join public.bookings as booking on booking.id = session.booking_id
    where (((session.checked_in_at at time zone 'Asia/Manila') - interval '8 hours')::date)
      between p_start_date and p_end_date
    group by 1
  ),
  walk_in_metrics as (
    select
      business_date as report_date,
      count(*) filter (where status in ('active', 'completed'))::bigint as walk_in_count,
      count(*) filter (where status in ('active', 'completed'))::bigint as walk_in_checkins,
      coalesce(sum(charged_amount_cents) filter (
        where status = 'completed' and payment_status = 'paid'
      ), 0)::bigint as walk_in_revenue_cents,
      coalesce(sum(charged_amount_cents) filter (
        where status = 'completed' and payment_status = 'unpaid'
      ), 0)::bigint as outstanding_walk_in_cents,
      coalesce(sum(greatest(0, extract(epoch from (coalesce(ended_at, now()) - started_at)) / 3600.0))
        filter (where status in ('active', 'completed')), 0)::numeric(12, 2) as walk_in_seat_hours,
      coalesce(sum(charged_amount_cents) filter (where status = 'completed' and payment_status = 'paid' and payment_method = 'cash'), 0)::bigint as cash_revenue_cents,
      coalesce(sum(charged_amount_cents) filter (where status = 'completed' and payment_status = 'paid' and payment_method = 'gcash'), 0)::bigint as gcash_revenue_cents,
      coalesce(sum(charged_amount_cents) filter (where status = 'completed' and payment_status = 'paid' and payment_method = 'qrph'), 0)::bigint as qrph_revenue_cents,
      coalesce(sum(charged_amount_cents) filter (where status = 'completed' and payment_status = 'paid' and payment_method = 'other'), 0)::bigint as other_revenue_cents
    from public.walk_in_occupancies
    where business_date between p_start_date and p_end_date
    group by business_date
  ),
  capacity as (
    select (count(*) filter (where is_active) * 21)::numeric as available_seat_hours
    from public.seats
  )
  select
    dates.report_date,
    coalesce(reservation_metrics.reservation_count, 0),
    coalesce(walk_in_metrics.walk_in_count, 0),
    coalesce(reservation_metrics.reservation_count, 0) + coalesce(walk_in_metrics.walk_in_count, 0),
    coalesce(reservation_metrics.reservation_revenue_cents, 0),
    coalesce(walk_in_metrics.walk_in_revenue_cents, 0),
    coalesce(reservation_metrics.reservation_revenue_cents, 0) + coalesce(walk_in_metrics.walk_in_revenue_cents, 0),
    coalesce(reservation_usage.reservation_checkins, 0),
    coalesce(walk_in_metrics.walk_in_checkins, 0),
    coalesce(reservation_usage.reservation_checkins, 0) + coalesce(walk_in_metrics.walk_in_checkins, 0),
    coalesce(reservation_usage.reservation_seat_hours, 0),
    coalesce(walk_in_metrics.walk_in_seat_hours, 0),
    coalesce(reservation_usage.reservation_seat_hours, 0) + coalesce(walk_in_metrics.walk_in_seat_hours, 0),
    capacity.available_seat_hours,
    coalesce(walk_in_metrics.outstanding_walk_in_cents, 0),
    coalesce(walk_in_metrics.cash_revenue_cents, 0),
    coalesce(walk_in_metrics.gcash_revenue_cents, 0),
    coalesce(walk_in_metrics.qrph_revenue_cents, 0),
    coalesce(walk_in_metrics.other_revenue_cents, 0)
  from dates
  cross join capacity
  left join reservation_metrics using (report_date)
  left join reservation_usage using (report_date)
  left join walk_in_metrics using (report_date)
  order by dates.report_date;
end;
$$;

create function public.start_walk_in(
  p_seat_code text,
  p_guest_name text default null,
  p_notes text default null
) returns uuid
language sql security invoker set search_path = '' as $$
  select private.start_walk_in(p_seat_code, p_guest_name, p_notes);
$$;

create function public.checkout_walk_in(
  p_walk_in_id uuid,
  p_ended_at timestamptz default null,
  p_payment_method text default 'cash',
  p_payment_status text default 'paid',
  p_charged_amount_cents bigint default null,
  p_override_reason text default null
) returns public.walk_in_occupancies
language sql security invoker set search_path = '' as $$
  select private.checkout_walk_in(
    p_walk_in_id, p_ended_at, p_payment_method, p_payment_status,
    p_charged_amount_cents, p_override_reason
  );
$$;

create function public.create_completed_walk_in(
  p_seat_code text,
  p_guest_name text,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_payment_method text default 'cash',
  p_payment_status text default 'paid',
  p_charged_amount_cents bigint default null,
  p_override_reason text default null,
  p_notes text default null
) returns uuid
language sql security invoker set search_path = '' as $$
  select private.create_completed_walk_in(
    p_seat_code, p_guest_name, p_started_at, p_ended_at, p_payment_method,
    p_payment_status, p_charged_amount_cents, p_override_reason, p_notes
  );
$$;

create function public.void_walk_in(
  p_walk_in_id uuid,
  p_reason text
) returns void
language sql security invoker set search_path = '' as $$
  select private.void_walk_in(p_walk_in_id, p_reason);
$$;

create function public.get_business_report(
  p_start_date date,
  p_end_date date
) returns table (
  report_date date,
  reservation_count bigint,
  walk_in_count bigint,
  total_visits bigint,
  reservation_revenue_cents bigint,
  walk_in_revenue_cents bigint,
  revenue_cents bigint,
  reservation_checkins bigint,
  walk_in_checkins bigint,
  checkins_count bigint,
  reservation_seat_hours numeric,
  walk_in_seat_hours numeric,
  occupied_seat_hours numeric,
  available_seat_hours numeric,
  outstanding_walk_in_cents bigint,
  cash_revenue_cents bigint,
  gcash_revenue_cents bigint,
  qrph_revenue_cents bigint,
  other_revenue_cents bigint
)
language sql security invoker set search_path = '' as $$
  select * from private.get_business_report(p_start_date, p_end_date);
$$;

revoke execute on function private.start_walk_in(text, text, text) from public, anon, authenticated, service_role;
revoke execute on function private.checkout_walk_in(uuid, timestamptz, text, text, bigint, text) from public, anon, authenticated, service_role;
revoke execute on function private.create_completed_walk_in(text, text, timestamptz, timestamptz, text, text, bigint, text, text) from public, anon, authenticated, service_role;
revoke execute on function private.void_walk_in(uuid, text) from public, anon, authenticated, service_role;
revoke execute on function private.get_business_report(date, date) from public, anon, authenticated, service_role;
revoke execute on function public.start_walk_in(text, text, text) from public, anon;
revoke execute on function public.checkout_walk_in(uuid, timestamptz, text, text, bigint, text) from public, anon;
revoke execute on function public.create_completed_walk_in(text, text, timestamptz, timestamptz, text, text, bigint, text, text) from public, anon;
revoke execute on function public.void_walk_in(uuid, text) from public, anon;
revoke execute on function public.get_business_report(date, date) from public, anon;

grant execute on function private.start_walk_in(text, text, text) to authenticated;
grant execute on function private.checkout_walk_in(uuid, timestamptz, text, text, bigint, text) to authenticated;
grant execute on function private.create_completed_walk_in(text, text, timestamptz, timestamptz, text, text, bigint, text, text) to authenticated;
grant execute on function private.void_walk_in(uuid, text) to authenticated;
grant execute on function private.get_business_report(date, date) to authenticated;
grant execute on function public.start_walk_in(text, text, text) to authenticated;
grant execute on function public.checkout_walk_in(uuid, timestamptz, text, text, bigint, text) to authenticated;
grant execute on function public.create_completed_walk_in(text, text, timestamptz, timestamptz, text, text, bigint, text, text) to authenticated;
grant execute on function public.void_walk_in(uuid, text) to authenticated;
grant execute on function public.get_business_report(date, date) to authenticated;

-- Keep the old RPC safe for clients that have not refreshed yet. A legacy
-- checkout is recorded as unpaid until staff confirms billing in the new UI.
create or replace function private.toggle_walk_in_occupancy(
  p_seat_code text,
  p_guest_name text default null
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_walk_in_id uuid;
begin
  if v_actor is null or not private.has_staff_permission('seating') then
    raise exception 'Seating access required' using errcode = '42501';
  end if;

  select occupancy.id into v_walk_in_id
  from public.walk_in_occupancies as occupancy
  join public.seats as seat on seat.id = occupancy.seat_id
  where seat.code = upper(btrim(p_seat_code)) and occupancy.ended_at is null
  for update of occupancy;

  if v_walk_in_id is not null then
    perform private.checkout_walk_in(v_walk_in_id, now(), 'cash', 'unpaid', null, null);
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
    values (v_actor, 'Walk-in checked out', 'seat', upper(btrim(p_seat_code)),
      jsonb_build_object('occupancy_id', v_walk_in_id, 'legacy_toggle', true));
    return false;
  end if;

  v_walk_in_id := private.start_walk_in(p_seat_code, p_guest_name, null);
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (v_actor, 'Walk-in checked in', 'seat', upper(btrim(p_seat_code)),
    jsonb_build_object('occupancy_id', v_walk_in_id, 'legacy_toggle', true));
  return true;
end;
$$;

comment on table public.service_rate_plans is
  'Versionable pricing tiers used to calculate walk-in charges.';
comment on table public.walk_in_occupancies is
  'Walk-in service sessions, including occupancy, billing, payment, and audit metadata.';
comment on function public.get_business_report(date, date) is
  'Owner-only daily business report combining reservations and walk-in sessions.';
