-- Customer self-service reservation management. Schedule and seat changes are
-- atomic so availability, pricing, and booking_seats cannot drift apart.

create function private.get_available_seats_for_booking(
  p_booking_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns setof public.seats
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_ends_at <= p_starts_at then
    raise exception 'The reservation end must be after its start' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.bookings b
    where b.id = p_booking_id and b.user_id = v_actor
  ) then
    raise exception 'Reservation not found' using errcode = 'P0002';
  end if;

  return query
  select s.*
  from public.seats s
  where s.is_active
    and s.status <> 'maintenance'
    and not exists (
      select 1
      from public.booking_seats bs
      join public.bookings b on b.id = bs.booking_id
      where bs.seat_id = s.id
        and bs.active
        and bs.booking_id <> p_booking_id
        and not (
          b.status = 'pending'
          and b.payment_status = 'pending'
          and b.hold_expires_at <= now()
        )
        and bs.reserved_during && tstzrange(p_starts_at, p_ends_at, '[)')
    )
    and not (
      (p_starts_at at time zone 'Asia/Manila')::date
        = (now() at time zone 'Asia/Manila')::date
      and exists (
        select 1
        from public.walk_in_occupancies occupancy
        where occupancy.seat_id = s.id
          and occupancy.ended_at is null
      )
    )
  order by s.code;
end;
$$;

create function public.get_available_seats_for_booking(
  p_booking_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns setof public.seats
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from private.get_available_seats_for_booking(p_booking_id, p_starts_at, p_ends_at);
$$;

create function private.customer_update_booking(
  p_booking_id uuid,
  p_booking_date date,
  p_start_time time,
  p_seat_codes text[]
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_code text;
  v_seat_count integer;
  v_subtotal bigint;
  v_start_hour integer;
  v_hours_until_closing integer;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_booking
  from public.bookings b
  where b.id = p_booking_id and b.user_id = v_actor
  for update;

  if not found then
    raise exception 'Reservation not found' using errcode = 'P0002';
  end if;
  if v_booking.status <> 'confirmed' then
    raise exception 'Only confirmed reservations can be changed' using errcode = 'P0001';
  end if;
  if v_booking.starts_at <= now() + interval '2 hours' then
    raise exception 'Reservations can only be changed at least 2 hours before check-in' using errcode = 'P0001';
  end if;
  if coalesce(cardinality(p_seat_codes), 0) not between 1 and cardinality(v_booking.seat_ids)
     or cardinality(p_seat_codes) <> (select count(distinct value) from unnest(p_seat_codes) as value) then
    raise exception 'Choose between 1 and % unique seats (the number paid for)', cardinality(v_booking.seat_ids)
      using errcode = '22023';
  end if;

  v_starts_at := (p_booking_date::timestamp + p_start_time) at time zone 'Asia/Manila';
  v_ends_at := v_starts_at + make_interval(hours => v_booking.duration_hours);
  if v_starts_at <= now() + interval '1 hour' then
    raise exception 'The new reservation time must be at least 1 hour from now' using errcode = '22023';
  end if;
  v_start_hour := extract(hour from p_start_time)::integer;
  if extract(minute from p_start_time) <> 0
     or extract(second from p_start_time) <> 0
     or v_start_hour between 5 and 7 then
    raise exception 'Choose an hourly start time while the hub is open' using errcode = '22023';
  end if;
  v_hours_until_closing := case
    when v_start_hour >= 8 then 29 - v_start_hour
    else 5 - v_start_hour
  end;
  if v_booking.duration_hours > v_hours_until_closing then
    raise exception 'The reservation must end by the 5:00 AM closing time' using errcode = '22023';
  end if;

  -- Match create_booking's lock key and acquire every affected seat in a
  -- consistent order to prevent concurrent creates or updates from racing.
  for v_code in
    select code
    from (
      select unnest(v_booking.seat_ids) as code
      union
      select unnest(p_seat_codes) as code
    ) affected_seats
    order by code
  loop
    perform pg_advisory_xact_lock(hashtextextended('jit-seat:' || v_code, 0));
  end loop;

  -- Walk-in check-in locks the seat row. Taking those locks in code order
  -- serializes a same-seat walk-in against this reschedule transaction.
  perform 1
  from public.seats s
  where s.code = any(p_seat_codes)
  order by s.code
  for update;

  select count(*), coalesce(sum(s.hourly_rate_cents * v_booking.duration_hours), 0)
  into v_seat_count, v_subtotal
  from public.seats s
  where s.code = any(p_seat_codes)
    and s.is_active
    and s.status <> 'maintenance';

  if v_seat_count <> cardinality(p_seat_codes) then
    raise exception 'One or more seats are unavailable' using errcode = 'P0001';
  end if;
  if p_booking_date = (now() at time zone 'Asia/Manila')::date
     and exists (
       select 1
       from public.walk_in_occupancies occupancy
       join public.seats s on s.id = occupancy.seat_id
       where s.code = any(p_seat_codes)
         and occupancy.ended_at is null
     ) then
    raise exception 'One or more seats are occupied by an active walk-in' using errcode = 'P0001';
  end if;
  if v_subtotal <> v_booking.subtotal_cents then
    raise exception 'Choose seats with the same total price as the paid reservation' using errcode = 'P0001';
  end if;

  delete from public.booking_seats bs where bs.booking_id = v_booking.id;

  begin
    insert into public.booking_seats (booking_id, seat_id, reserved_during)
    select v_booking.id, s.id, tstzrange(v_starts_at, v_ends_at, '[)')
    from public.seats s
    where s.code = any(p_seat_codes);
  exception when exclusion_violation then
    raise exception 'One or more seats were just reserved for that time' using errcode = '23P01';
  end;

  update public.bookings b
  set booking_date = p_booking_date,
      start_time = p_start_time,
      starts_at = v_starts_at,
      ends_at = v_ends_at,
      seat_ids = p_seat_codes,
      confirmation_email_sent_at = null,
      confirmation_email_error = null,
      updated_at = now()
  where b.id = v_booking.id
  returning * into v_booking;

  update public.qr_access_passes q
  set expires_at = v_ends_at + interval '1 hour'
  where q.booking_id = v_booking.id
    and q.revoked_at is null;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (
    v_actor,
    'Updated own reservation',
    'booking',
    v_booking.id::text,
    jsonb_build_object(
      'reservation_code', v_booking.reservation_code,
      'starts_at', v_booking.starts_at,
      'seat_ids', v_booking.seat_ids
    )
  );

  return v_booking;
end;
$$;

create function public.customer_update_booking(
  p_booking_id uuid,
  p_booking_date date,
  p_start_time time,
  p_seat_codes text[]
)
returns public.bookings
language sql
security invoker
set search_path = ''
as $$
  select private.customer_update_booking(
    p_booking_id,
    p_booking_date,
    p_start_time,
    p_seat_codes
  );
$$;

-- Used only by the authenticated resend-booking-pass Edge Function. Reserving
-- the send timestamp under a row lock also enforces a per-booking cooldown.
create function private.prepare_booking_pass_resend(
  p_booking_id uuid,
  p_user_id uuid
)
returns table (
  booking_id uuid,
  reservation_code text,
  guest_name text,
  guest_email text,
  starts_at timestamptz,
  ends_at timestamptz,
  seat_ids text[],
  subtotal_cents bigint,
  confirmation_email_sent_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
begin
  if p_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select b.* into v_booking
  from public.bookings b
  join public.qr_access_passes q on q.booking_id = b.id
  where b.id = p_booking_id
    and b.user_id = p_user_id
    and b.status in ('confirmed', 'checked_in')
    and b.payment_status = 'paid'
    and q.revoked_at is null
    and q.expires_at > now()
  for update of b;

  if not found then
    raise exception 'An active QR pass was not found for this reservation' using errcode = 'P0002';
  end if;
  if v_booking.confirmation_email_sent_at > now() - interval '1 minute' then
    raise exception 'Please wait one minute before resending this QR pass' using errcode = 'P0001';
  end if;

  update public.bookings b
  set confirmation_email_sent_at = now(),
      confirmation_email_error = null,
      updated_at = now()
  where b.id = v_booking.id
  returning b.confirmation_email_sent_at into v_booking.confirmation_email_sent_at;

  return query
  select v_booking.id, v_booking.reservation_code, v_booking.guest_name,
         v_booking.guest_email, v_booking.starts_at, v_booking.ends_at,
         v_booking.seat_ids, v_booking.subtotal_cents,
         v_booking.confirmation_email_sent_at;
end;
$$;

create function public.prepare_booking_pass_resend(
  p_booking_id uuid,
  p_user_id uuid
)
returns table (
  booking_id uuid,
  reservation_code text,
  guest_name text,
  guest_email text,
  starts_at timestamptz,
  ends_at timestamptz,
  seat_ids text[],
  subtotal_cents bigint,
  confirmation_email_sent_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.prepare_booking_pass_resend(p_booking_id, p_user_id);
$$;

revoke execute on function private.get_available_seats_for_booking(uuid, timestamptz, timestamptz)
  from public, anon, authenticated, service_role;
revoke execute on function private.customer_update_booking(uuid, date, time, text[])
  from public, anon, authenticated, service_role;
revoke execute on function private.prepare_booking_pass_resend(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke execute on function public.get_available_seats_for_booking(uuid, timestamptz, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.customer_update_booking(uuid, date, time, text[])
  from public, anon, authenticated;
revoke execute on function public.prepare_booking_pass_resend(uuid, uuid)
  from public, anon, authenticated;

grant execute on function private.get_available_seats_for_booking(uuid, timestamptz, timestamptz)
  to authenticated;
grant execute on function private.customer_update_booking(uuid, date, time, text[])
  to authenticated;
grant execute on function public.get_available_seats_for_booking(uuid, timestamptz, timestamptz)
  to authenticated;
grant execute on function public.customer_update_booking(uuid, date, time, text[])
  to authenticated;
grant execute on function private.prepare_booking_pass_resend(uuid, uuid)
  to service_role;
grant execute on function public.prepare_booking_pass_resend(uuid, uuid)
  to service_role;

comment on function public.customer_update_booking(uuid, date, time, text[]) is
  'Atomically reschedules the calling customer''s confirmed reservation and/or replaces its seats without changing the paid total.';
comment on function public.get_available_seats_for_booking(uuid, timestamptz, timestamptz) is
  'Lists available seats for a customer-owned booking while excluding that booking from conflict checks.';
comment on function public.prepare_booking_pass_resend(uuid, uuid) is
  'Server-only ownership, active-pass, and cooldown check for QR-pass email resends.';
