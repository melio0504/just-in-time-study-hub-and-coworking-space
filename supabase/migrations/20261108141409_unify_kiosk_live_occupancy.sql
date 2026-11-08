-- HC16 is no longer part of the physical facility. Future confirmed bookings
-- may already reference it, so move each reservation to an available active
-- high-chair with the same rate before deleting the seat. The advisory and row
-- locks match the booking flows' ordering and keep the reassignment atomic with
-- concurrent reservations.
do $$
declare
  v_hc16_id uuid;
  v_hc16_seat_type text;
  v_hc16_hourly_rate_cents bigint;
  v_seat_code text;
  v_booking record;
  v_replacement_id uuid;
  v_replacement_code text;
  v_updated_seat_ids text[];
begin
  perform set_config('lock_timeout', '15s', true);

  select seat.id, seat.seat_type, seat.hourly_rate_cents
  into v_hc16_id, v_hc16_seat_type, v_hc16_hourly_rate_cents
  from public.seats as seat
  where seat.code = 'HC16';

  if not found then
    raise exception 'HC16 seat record was not found';
  end if;

  for v_seat_code in
    select seat.code
    from public.seats as seat
    where seat.seat_type = v_hc16_seat_type
    order by seat.code
  loop
    perform pg_advisory_xact_lock(hashtextextended('jit-seat:' || v_seat_code, 0));
  end loop;

  perform 1
  from public.seats as seat
  where seat.seat_type = v_hc16_seat_type
  order by seat.code
  for update;

  if exists (
    select 1
    from public.walk_in_occupancies as occupancy
    where occupancy.seat_id = v_hc16_id
  ) then
    raise exception 'HC16 cannot be deleted while walk-in history references it';
  end if;

  if exists (
    select 1
    from public.booking_seats as booking_seat
    join public.bookings as booking on booking.id = booking_seat.booking_id
    where booking_seat.seat_id = v_hc16_id
      and (
        not booking_seat.active
        or booking.status <> 'confirmed'
        or booking.starts_at <= now()
        or coalesce(cardinality(array_positions(booking.seat_ids, 'HC16')), 0) <> 1
      )
  ) then
    raise exception 'HC16 has a booking reference that cannot be safely reassigned';
  end if;

  for v_booking in
    select
      booking_seat.booking_id,
      booking_seat.reserved_during,
      booking.seat_ids
    from public.booking_seats as booking_seat
    join public.bookings as booking on booking.id = booking_seat.booking_id
    where booking_seat.seat_id = v_hc16_id
    order by lower(booking_seat.reserved_during), booking_seat.booking_id
    for update of booking_seat, booking
  loop
    select candidate.id, candidate.code
    into v_replacement_id, v_replacement_code
    from public.seats as candidate
    where candidate.id <> v_hc16_id
      and candidate.seat_type = v_hc16_seat_type
      and candidate.hourly_rate_cents = v_hc16_hourly_rate_cents
      and candidate.is_active
      and candidate.status <> 'maintenance'
      and not (candidate.code = any(v_booking.seat_ids))
      and not exists (
        select 1
        from public.booking_seats as same_booking_seat
        where same_booking_seat.booking_id = v_booking.booking_id
          and same_booking_seat.seat_id = candidate.id
      )
      and not exists (
        select 1
        from public.booking_seats as conflicting_booking_seat
        where conflicting_booking_seat.seat_id = candidate.id
          and conflicting_booking_seat.active
          and conflicting_booking_seat.reserved_during && v_booking.reserved_during
      )
    order by candidate.code
    limit 1;

    if not found then
      raise exception 'No same-rate high-chair is available to replace HC16 for booking %',
        v_booking.booking_id;
    end if;

    update public.booking_seats
    set seat_id = v_replacement_id
    where booking_id = v_booking.booking_id
      and seat_id = v_hc16_id;

    select array_agg(
      case when seat_code.code = 'HC16' then v_replacement_code else seat_code.code end
      order by seat_code.position
    )
    into v_updated_seat_ids
    from unnest(v_booking.seat_ids) with ordinality as seat_code(code, position);

    update public.bookings
    set seat_ids = v_updated_seat_ids,
        updated_at = now()
    where id = v_booking.booking_id;

    insert into public.audit_logs (action, entity_type, entity_id, details)
    values (
      'Reassigned removed facility seat',
      'booking',
      v_booking.booking_id::text,
      jsonb_build_object('removed_seat', 'HC16', 'replacement_seat', v_replacement_code)
    );
  end loop;

  if exists (select 1 from public.booking_seats where seat_id = v_hc16_id) then
    raise exception 'HC16 still has booking references after reassignment';
  end if;

  delete from public.seats
  where id = v_hc16_id;
end;
$$;

-- The kiosk must represent physical occupancy, not only QR reservations that
-- are still within their scheduled time. Include overtime reservations and
-- active walk-ins in the same session-shaped response.
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
    active_session.booking_id,
    active_session.guest_name,
    active_session.seats,
    active_session.checked_in_at,
    active_session.scheduled_end
  from (
    select
      booking.reservation_code as booking_id,
      booking.guest_name,
      booking.seat_ids as seats,
      session.checked_in_at,
      session.scheduled_end_at as scheduled_end
    from public.check_in_sessions as session
    join public.bookings as booking on booking.id = session.booking_id
    where session.status in ('checked_in', 'overtime')
      and session.checked_out_at is null

    union all

    select
      'walk-in:' || occupancy.id::text as booking_id,
      coalesce(occupancy.guest_name, 'Walk-in guest') as guest_name,
      array[seat.code]::text[] as seats,
      occupancy.started_at as checked_in_at,
      null::timestamptz as scheduled_end
    from public.walk_in_occupancies as occupancy
    join public.seats as seat on seat.id = occupancy.seat_id
    where occupancy.ended_at is null
      and seat.is_active
  ) as active_session
  order by active_session.checked_in_at desc;
$$;

comment on function public.get_kiosk_active_sessions() is
  'Returns checked-in and overtime reservations plus active walk-ins to the device-authenticated kiosk Edge Function.';

create or replace function private.get_kiosk_active_seat_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.seats
  where is_active;
$$;

create or replace function public.get_kiosk_active_seat_count()
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_kiosk_active_seat_count();
$$;

revoke execute on function private.get_kiosk_active_seat_count()
  from public, anon, authenticated, service_role;
revoke execute on function public.get_kiosk_active_seat_count()
  from public, anon, authenticated, service_role;

grant execute on function private.get_kiosk_active_seat_count() to service_role;
grant execute on function public.get_kiosk_active_seat_count() to service_role;

comment on function public.get_kiosk_active_seat_count() is
  'Returns the active facility capacity to the device-authenticated kiosk Edge Function.';
