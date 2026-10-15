-- Keep the check-in window authoritative in Postgres while giving trusted
-- kiosk callers enough structured detail to explain when a guest may scan.
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
  v_is_service boolean := coalesce((select auth.jwt() ->> 'role'), '') = 'service_role';
  v_booking public.bookings%rowtype;
  v_pass public.qr_access_passes%rowtype;
  v_now timestamptz := now();
begin
  if not v_is_service and (v_actor is null or not private.has_staff_permission('seating')) then
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
