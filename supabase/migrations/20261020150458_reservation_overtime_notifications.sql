create extension if not exists pg_net with schema extensions;

alter table public.check_in_sessions
  add column end_reminder_claimed_at timestamptz,
  add column end_reminder_sent_at timestamptz,
  add column end_reminder_error text;

alter table public.check_in_sessions
  add constraint check_in_sessions_end_reminder_error_length_check
  check (end_reminder_error is null or char_length(end_reminder_error) <= 1000);

create index check_in_sessions_end_reminder_due_idx
  on public.check_in_sessions (scheduled_end_at)
  where status in ('checked_in', 'overtime') and end_reminder_sent_at is null;

create or replace function private.calculate_booking_overtime(
  p_booking_id uuid,
  p_scheduled_end_at timestamptz,
  p_calculated_at timestamptz default now()
)
returns table (
  overtime_minutes integer,
  billable_hours integer,
  hourly_rate_cents bigint,
  charge_cents bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with overtime as (
    select greatest(
      0,
      floor(extract(epoch from (p_calculated_at - p_scheduled_end_at)) / 60)::integer
    ) as minutes
  ), rate as (
    select coalesce(sum(seat.hourly_rate_cents), 0)::bigint as cents
    from public.booking_seats as booking_seat
    join public.seats as seat on seat.id = booking_seat.seat_id
    where booking_seat.booking_id = p_booking_id
  )
  select
    overtime.minutes,
    case
      when overtime.minutes >= 20 then ceil(overtime.minutes / 60.0)::integer
      else 0
    end,
    rate.cents,
    case
      when overtime.minutes >= 20
        then rate.cents * ceil(overtime.minutes / 60.0)::integer
      else 0
    end
  from overtime
  cross join rate;
$$;

comment on function private.calculate_booking_overtime(uuid, timestamptz, timestamptz) is
  'Calculates whole-hour overtime charges after a 20-minute grace period using the current combined hourly rate of every reserved seat.';

create or replace function private.refresh_active_overtime_sessions()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_updated integer;
begin
  with calculations as (
    select
      session.id,
      session.status,
      overtime.overtime_minutes,
      overtime.charge_cents
    from public.check_in_sessions as session
    cross join lateral private.calculate_booking_overtime(
      session.booking_id,
      session.scheduled_end_at,
      now()
    ) as overtime
    where session.status in ('checked_in', 'overtime')
      and session.checked_out_at is null
      and session.scheduled_end_at <= now()
      and (
        session.overtime_minutes is distinct from overtime.overtime_minutes
        or session.overtime_charge_cents is distinct from overtime.charge_cents
        or (overtime.charge_cents > 0 and session.status <> 'overtime')
      )
  ), refreshed as (
    update public.check_in_sessions as session
    set
      status = case
        when calculations.charge_cents > 0 then 'overtime'::public.check_in_status
        else calculations.status
      end,
      overtime_minutes = calculations.overtime_minutes,
      overtime_charge_cents = calculations.charge_cents
    from calculations
    where session.id = calculations.id
    returning session.id
  )
  select count(*)::integer into v_updated from refreshed;

  return v_updated;
end;
$$;

create or replace function private.claim_end_time_reminders(p_limit integer default 50)
returns table (
  session_id uuid,
  booking_id uuid,
  reservation_code text,
  guest_name text,
  guest_email text,
  seat_ids text[],
  scheduled_end_at timestamptz,
  hourly_rate_cents bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Reminder batch size must be between 1 and 100' using errcode = '22023';
  end if;

  return query
  with candidates as (
    select session.id
    from public.check_in_sessions as session
    where session.status in ('checked_in', 'overtime')
      and session.checked_out_at is null
      and session.end_reminder_sent_at is null
      and (
        session.end_reminder_claimed_at is null
        or session.end_reminder_claimed_at <= now() - interval '10 minutes'
      )
      and session.scheduled_end_at > now()
      and session.scheduled_end_at <= now() + interval '30 minutes'
    order by session.scheduled_end_at, session.id
    for update skip locked
    limit p_limit
  ), claimed as (
    update public.check_in_sessions as session
    set end_reminder_claimed_at = now(), end_reminder_error = null
    from candidates
    where session.id = candidates.id
    returning session.id, session.booking_id, session.scheduled_end_at
  )
  select
    claimed.id,
    booking.id,
    booking.reservation_code,
    booking.guest_name,
    booking.guest_email,
    booking.seat_ids,
    claimed.scheduled_end_at,
    coalesce(sum(seat.hourly_rate_cents), 0)::bigint
  from claimed
  join public.bookings as booking on booking.id = claimed.booking_id
  join public.booking_seats as booking_seat on booking_seat.booking_id = booking.id
  join public.seats as seat on seat.id = booking_seat.seat_id
  group by
    claimed.id,
    booking.id,
    booking.reservation_code,
    booking.guest_name,
    booking.guest_email,
    booking.seat_ids,
    claimed.scheduled_end_at
  order by claimed.scheduled_end_at, claimed.id;
end;
$$;

create or replace function public.claim_end_time_reminders(p_limit integer default 50)
returns table (
  session_id uuid,
  booking_id uuid,
  reservation_code text,
  guest_name text,
  guest_email text,
  seat_ids text[],
  scheduled_end_at timestamptz,
  hourly_rate_cents bigint
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.claim_end_time_reminders(p_limit);
$$;

create or replace function private.complete_end_time_reminder(
  p_session_id uuid,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;

  update public.check_in_sessions
  set
    end_reminder_claimed_at = case when p_error is null then null else now() end,
    end_reminder_sent_at = case when p_error is null then now() else end_reminder_sent_at end,
    end_reminder_error = case when p_error is null then null else left(p_error, 1000) end
  where id = p_session_id
    and end_reminder_sent_at is null;

  if not found then
    raise exception 'Reminder session not found or already completed' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.complete_end_time_reminder(
  p_session_id uuid,
  p_error text default null
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.complete_end_time_reminder(p_session_id, p_error);
$$;

create or replace function private.invoke_end_time_reminder_function()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_url text;
  v_publishable_key text;
  v_cron_secret text;
  v_request_id bigint;
begin
  select secret.decrypted_secret into v_project_url
  from vault.decrypted_secrets as secret
  where secret.name = 'project_url'
  order by secret.created_at desc
  limit 1;

  select secret.decrypted_secret into v_publishable_key
  from vault.decrypted_secrets as secret
  where secret.name = 'publishable_key'
  order by secret.created_at desc
  limit 1;

  select secret.decrypted_secret into v_cron_secret
  from vault.decrypted_secrets as secret
  where secret.name = 'end_time_reminder_cron_secret'
  order by secret.created_at desc
  limit 1;

  if nullif(btrim(v_project_url), '') is null
    or nullif(btrim(v_publishable_key), '') is null
    or nullif(btrim(v_cron_secret), '') is null then
    raise warning 'End-time reminders are not configured in Vault';
    return null;
  end if;

  select net.http_post(
    url := rtrim(v_project_url, '/') || '/functions/v1/send-end-time-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', v_publishable_key,
      'x-cron-secret', v_cron_secret
    ),
    body := jsonb_build_object('requestedAt', now())
  ) into v_request_id;

  return v_request_id;
end;
$$;

create or replace function private.run_reservation_time_automation()
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform private.refresh_active_overtime_sessions();
  perform private.invoke_end_time_reminder_function();
end;
$$;

revoke all on function private.calculate_booking_overtime(uuid, timestamptz, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.refresh_active_overtime_sessions()
  from public, anon, authenticated, service_role;
revoke all on function private.claim_end_time_reminders(integer)
  from public, anon, authenticated, service_role;
revoke all on function private.complete_end_time_reminder(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function private.invoke_end_time_reminder_function()
  from public, anon, authenticated, service_role;
revoke all on function private.run_reservation_time_automation()
  from public, anon, authenticated, service_role;
revoke all on function public.claim_end_time_reminders(integer)
  from public, anon, authenticated, service_role;
revoke all on function public.complete_end_time_reminder(uuid, text)
  from public, anon, authenticated, service_role;

grant execute on function private.claim_end_time_reminders(integer) to service_role;
grant execute on function private.complete_end_time_reminder(uuid, text) to service_role;
grant execute on function public.claim_end_time_reminders(integer) to service_role;
grant execute on function public.complete_end_time_reminder(uuid, text) to service_role;

select cron.schedule(
  'process-reservation-time-notifications',
  '* * * * *',
  'select private.run_reservation_time_automation();'
);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'check_in_sessions'
    ) then
    alter publication supabase_realtime add table public.check_in_sessions;
  end if;
end;
$$;

drop function public.process_kiosk_scan(text);
drop function private.process_kiosk_scan(text);

create function private.process_kiosk_scan(p_token_hash text)
returns table (
  action text,
  booking_id uuid,
  reservation_code text,
  guest_name text,
  seat_ids text[],
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  scanned_at timestamptz,
  overtime_minutes integer,
  overtime_billable_hours integer,
  hourly_rate_cents bigint,
  overtime_charge_cents bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_is_service boolean := coalesce((select auth.jwt() ->> 'role'), '') = 'service_role';
  v_booking public.bookings%rowtype;
  v_pass public.qr_access_passes%rowtype;
  v_now timestamptz := now();
  v_overtime_minutes integer := 0;
  v_billable_hours integer := 0;
  v_hourly_rate_cents bigint := 0;
  v_overtime_charge_cents bigint := 0;
begin
  if not v_is_service and (v_actor is null or not private.has_staff_permission('seating')) then
    raise exception 'This kiosk is not signed in with seating access' using errcode = '42501';
  end if;

  select pass.* into v_pass
  from public.qr_access_passes as pass
  where pass.token_hash = p_token_hash
  for update;

  if not found or v_pass.revoked_at is not null then
    raise exception 'Invalid or already used QR pass' using errcode = 'P0001';
  end if;

  select booking.* into v_booking
  from public.bookings as booking
  where booking.id = v_pass.booking_id
  for update;

  if not found then
    raise exception 'The booking linked to this QR pass no longer exists' using errcode = 'P0002';
  end if;

  perform seat.id
  from public.seats as seat
  join public.booking_seats as booking_seat on booking_seat.seat_id = seat.id
  where booking_seat.booking_id = v_booking.id
  order by seat.id
  for update of seat;

  if v_booking.status = 'pending' then
    raise exception 'The reservation has not been confirmed' using errcode = 'P0001';
  end if;
  if v_booking.status = 'completed' then
    raise exception 'This reservation is already completed' using errcode = 'P0001';
  end if;
  if v_booking.status in ('cancelled', 'declined', 'no_show') then
    raise exception 'This reservation is no longer active' using errcode = 'P0001';
  end if;

  if v_booking.status = 'confirmed' then
    if v_now > v_pass.expires_at or v_now > v_booking.ends_at then
      raise exception 'This booking has expired' using errcode = 'P0001';
    end if;
    if v_now < v_booking.starts_at - interval '15 minutes' then
      raise exception 'This reservation is not ready for check-in yet'
        using errcode = 'P0001',
              detail = jsonb_build_object(
                'code', 'check_in_not_open',
                'checkInOpensAt', v_booking.starts_at - interval '15 minutes',
                'scheduledStart', v_booking.starts_at,
                'scheduledEnd', v_booking.ends_at
              )::text;
    end if;

    insert into public.check_in_sessions (
      booking_id, qr_access_pass_id, scheduled_end_at, verified_by
    ) values (
      v_booking.id, v_pass.id, v_booking.ends_at, v_actor
    );
    update public.bookings set status = 'checked_in' where id = v_booking.id;
    update public.seats as seat set status = 'occupied'
    from public.booking_seats as booking_seat
    where booking_seat.booking_id = v_booking.id and booking_seat.seat_id = seat.id;
    update public.qr_access_passes set last_scanned_at = v_now where id = v_pass.id;

    select overtime.overtime_minutes, overtime.billable_hours,
      overtime.hourly_rate_cents, overtime.charge_cents
    into v_overtime_minutes, v_billable_hours, v_hourly_rate_cents, v_overtime_charge_cents
    from private.calculate_booking_overtime(v_booking.id, v_booking.ends_at, v_now) as overtime;

    return query select 'check-in'::text, v_booking.id, v_booking.reservation_code,
      v_booking.guest_name, v_booking.seat_ids, v_booking.starts_at, v_booking.ends_at, v_now,
      v_overtime_minutes, v_billable_hours, v_hourly_rate_cents, v_overtime_charge_cents;
    return;
  end if;

  if v_booking.status = 'checked_in' then
    select overtime.overtime_minutes, overtime.billable_hours,
      overtime.hourly_rate_cents, overtime.charge_cents
    into v_overtime_minutes, v_billable_hours, v_hourly_rate_cents, v_overtime_charge_cents
    from private.calculate_booking_overtime(v_booking.id, v_booking.ends_at, v_now) as overtime;

    update public.check_in_sessions as session
    set
      status = 'checked_out',
      checked_out_at = v_now,
      overtime_minutes = v_overtime_minutes,
      overtime_charge_cents = v_overtime_charge_cents
    where session.booking_id = v_booking.id
      and session.status in ('checked_in', 'overtime');
    update public.bookings set status = 'completed' where id = v_booking.id;
    update public.booking_seats as booking_seat
    set active = false
    where booking_seat.booking_id = v_booking.id;
    update public.seats as seat set status = 'available'
    from public.booking_seats as booking_seat
    where booking_seat.booking_id = v_booking.id and booking_seat.seat_id = seat.id;
    update public.qr_access_passes
    set last_scanned_at = v_now, revoked_at = v_now
    where id = v_pass.id;

    return query select 'check-out'::text, v_booking.id, v_booking.reservation_code,
      v_booking.guest_name, v_booking.seat_ids, v_booking.starts_at, v_booking.ends_at, v_now,
      v_overtime_minutes, v_billable_hours, v_hourly_rate_cents, v_overtime_charge_cents;
    return;
  end if;

  raise exception 'This reservation cannot be scanned in its current state' using errcode = 'P0001';
end;
$$;

create function public.process_kiosk_scan(p_token_hash text)
returns table (
  action text,
  booking_id uuid,
  reservation_code text,
  guest_name text,
  seat_ids text[],
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  scanned_at timestamptz,
  overtime_minutes integer,
  overtime_billable_hours integer,
  hourly_rate_cents bigint,
  overtime_charge_cents bigint
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.process_kiosk_scan(p_token_hash);
$$;

revoke all on function private.process_kiosk_scan(text)
  from public, anon, authenticated, service_role;
revoke all on function public.process_kiosk_scan(text)
  from public, anon, authenticated, service_role;
grant execute on function private.process_kiosk_scan(text) to authenticated, service_role;
grant execute on function public.process_kiosk_scan(text) to authenticated, service_role;

comment on function public.process_kiosk_scan(text) is
  'Atomically checks a confirmed booking in or out and returns any 20-minute-threshold overtime charge using current seat pricing.';
