-- Database-backed booking confirmation email and kiosk access.

alter table public.bookings
  add column confirmation_email_sent_at timestamptz,
  add column confirmation_email_error text;

alter table public.qr_access_passes
  add column last_scanned_at timestamptz;

create or replace function private.release_expired_booking_holds()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.booking_seats bs
  set active = false
  from public.bookings b
  where b.id = bs.booking_id
    and bs.active
    and b.status = 'pending'
    and b.payment_status = 'pending'
    and b.hold_expires_at <= now();

  update public.bookings
  set status = 'declined', payment_status = 'failed'
  where status = 'pending'
    and payment_status = 'pending'
    and hold_expires_at <= now();
end;
$$;

create or replace function private.release_expired_booking_holds_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.release_expired_booking_holds();
  return new;
end;
$$;

create trigger bookings_release_expired_holds
before insert on public.bookings
for each statement execute function private.release_expired_booking_holds_before_insert();

create or replace function private.get_available_seats(p_starts_at timestamptz, p_ends_at timestamptz)
returns setof public.seats
language sql
stable
security definer
set search_path = ''
as $$
  select s.*
  from public.seats s
  where s.is_active
    and s.status <> 'maintenance'
    and p_ends_at > p_starts_at
    and not exists (
      select 1
      from public.booking_seats bs
      join public.bookings b on b.id = bs.booking_id
      where bs.seat_id = s.id
        and bs.active
        and not (
          b.status = 'pending'
          and b.payment_status = 'pending'
          and b.hold_expires_at <= now()
        )
        and bs.reserved_during && tstzrange(p_starts_at, p_ends_at, '[)')
    )
  order by s.code;
$$;

create or replace function private.mark_booking_confirmation_email(
  p_booking_id uuid,
  p_error text default null
) returns void
language sql
security definer
set search_path = ''
as $$
  update public.bookings
  set confirmation_email_sent_at = case when p_error is null then now() else confirmation_email_sent_at end,
      confirmation_email_error = p_error
  where id = p_booking_id;
$$;

create or replace function public.mark_booking_confirmation_email(
  p_booking_id uuid,
  p_error text default null
) returns void
language sql
security invoker
set search_path = ''
as $$
  select private.mark_booking_confirmation_email(p_booking_id, p_error);
$$;

create or replace function private.process_kiosk_scan(p_token_hash text)
returns table (
  action text,
  booking_id uuid,
  reservation_code text,
  guest_name text,
  seat_ids text[],
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  scanned_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_pass public.qr_access_passes%rowtype;
  v_now timestamptz := now();
begin
  if v_actor is null or not private.has_staff_permission('seating') then
    raise exception 'This kiosk is not signed in with seating access' using errcode = '42501';
  end if;

  select q.* into v_pass
  from public.qr_access_passes q
  where q.token_hash = p_token_hash
  for update;

  if not found or v_pass.revoked_at is not null then
    raise exception 'Invalid or already used QR pass' using errcode = 'P0001';
  end if;

  select b.* into v_booking
  from public.bookings b
  where b.id = v_pass.booking_id
  for update;

  if not found then
    raise exception 'The booking linked to this QR pass no longer exists' using errcode = 'P0002';
  end if;

  perform s.id
  from public.seats s
  join public.booking_seats bs on bs.seat_id = s.id
  where bs.booking_id = v_booking.id
  order by s.id
  for update of s;

  if v_booking.status = 'pending' then
    raise exception 'The reservation has not been confirmed' using errcode = 'P0001';
  end if;
  if v_now > v_pass.expires_at or v_now > v_booking.ends_at then
    raise exception 'This booking has expired' using errcode = 'P0001';
  end if;
  if v_booking.status = 'completed' then
    raise exception 'This reservation is already completed' using errcode = 'P0001';
  end if;
  if v_booking.status in ('cancelled', 'declined', 'no_show') then
    raise exception 'This reservation is no longer active' using errcode = 'P0001';
  end if;

  if v_booking.status = 'confirmed' then
    if v_now < v_booking.starts_at - interval '15 minutes' then
      raise exception 'This reservation is not ready for check-in yet' using errcode = 'P0001';
    end if;

    insert into public.check_in_sessions (
      booking_id, qr_access_pass_id, scheduled_end_at, verified_by
    ) values (
      v_booking.id, v_pass.id, v_booking.ends_at, v_actor
    );
    update public.bookings set status = 'checked_in' where id = v_booking.id;
    update public.seats s set status = 'occupied'
    from public.booking_seats bs
    where bs.booking_id = v_booking.id and bs.seat_id = s.id;
    update public.qr_access_passes set last_scanned_at = v_now where id = v_pass.id;

    return query select 'check-in'::text, v_booking.id, v_booking.reservation_code,
      v_booking.guest_name, v_booking.seat_ids, v_booking.starts_at, v_booking.ends_at, v_now;
    return;
  end if;

  if v_booking.status = 'checked_in' then
    update public.check_in_sessions cis
    set status = 'checked_out',
        checked_out_at = v_now,
        overtime_minutes = greatest(0, floor(extract(epoch from (v_now - cis.scheduled_end_at)) / 60)::integer)
    where cis.booking_id = v_booking.id and cis.status = 'checked_in';
    update public.bookings set status = 'completed' where id = v_booking.id;
    update public.booking_seats bs set active = false where bs.booking_id = v_booking.id;
    update public.seats s set status = 'available'
    from public.booking_seats bs
    where bs.booking_id = v_booking.id and bs.seat_id = s.id;
    update public.qr_access_passes
    set last_scanned_at = v_now, revoked_at = v_now
    where id = v_pass.id;

    return query select 'check-out'::text, v_booking.id, v_booking.reservation_code,
      v_booking.guest_name, v_booking.seat_ids, v_booking.starts_at, v_booking.ends_at, v_now;
    return;
  end if;

  raise exception 'This reservation cannot be scanned in its current state' using errcode = 'P0001';
end;
$$;

create or replace function public.process_kiosk_scan(p_token_hash text)
returns table (
  action text,
  booking_id uuid,
  reservation_code text,
  guest_name text,
  seat_ids text[],
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  scanned_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.process_kiosk_scan(p_token_hash);
$$;

revoke execute on function private.release_expired_booking_holds()
  from public, anon, authenticated, service_role;
revoke execute on function private.release_expired_booking_holds_before_insert()
  from public, anon, authenticated, service_role;
revoke execute on function private.mark_booking_confirmation_email(uuid, text)
  from public, anon, authenticated, service_role;
revoke execute on function private.process_kiosk_scan(text)
  from public, anon, authenticated, service_role;
revoke execute on function public.mark_booking_confirmation_email(uuid, text)
  from public, anon, authenticated;
revoke execute on function public.process_kiosk_scan(text)
  from public, anon;

grant execute on function private.mark_booking_confirmation_email(uuid, text) to service_role;
grant execute on function private.process_kiosk_scan(text) to authenticated;
grant execute on function public.mark_booking_confirmation_email(uuid, text) to service_role;
grant execute on function public.process_kiosk_scan(text) to authenticated;
grant usage on schema private to service_role;

drop policy "Users read own check-ins; reservation staff read all" on public.check_in_sessions;
create policy "Users read own check-ins; operations staff read all"
on public.check_in_sessions for select to authenticated using (
  exists (
    select 1 from public.bookings
    where bookings.id = check_in_sessions.booking_id
      and (
        bookings.user_id = (select auth.uid())
        or (select private.has_staff_permission('seating'))
        or (select private.has_staff_permission('reservations'))
      )
  )
);

comment on function public.process_kiosk_scan(text)
  is 'Atomically checks a confirmed booking in or out using a hashed QR pass token.';
