create or replace function private.confirm_booking_from_token(
  p_token_hash text,
  p_access_token_hash text
) returns table (
  booking_id uuid,
  reservation_code text,
  guest_name text,
  guest_email text,
  starts_at timestamptz,
  ends_at timestamptz,
  seat_ids text[],
  subtotal_cents bigint,
  confirmation_email_sent_at timestamptz,
  newly_confirmed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token public.booking_confirmation_tokens%rowtype;
  v_booking public.bookings%rowtype;
  v_newly_confirmed boolean := false;
begin
  if p_token_hash !~ '^[0-9a-f]{64}$' or p_access_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid confirmation token' using errcode = '22023';
  end if;

  select * into v_token
  from public.booking_confirmation_tokens
  where token_hash = p_token_hash
  for update;

  if not found then
    raise exception 'This confirmation QR code is invalid' using errcode = 'P0001';
  end if;
  if v_token.confirmed_at is null and v_token.expires_at <= now() then
    raise exception 'This confirmation QR code has expired' using errcode = 'P0001';
  end if;

  select * into v_booking
  from public.bookings
  where id = v_token.booking_id
  for update;

  if not found then
    raise exception 'The reservation no longer exists' using errcode = 'P0002';
  end if;

  if v_token.confirmed_at is null then
    if v_booking.status <> 'pending' or v_booking.payment_status <> 'pending' then
      raise exception 'This reservation can no longer be confirmed' using errcode = 'P0001';
    end if;
    if v_booking.hold_expires_at is null or v_booking.hold_expires_at <= now() then
      raise exception 'The seat hold expired. Please create a new reservation.' using errcode = 'P0001';
    end if;

    update public.bookings
    set status = 'confirmed',
        payment_status = 'not_required',
        hold_expires_at = null,
        confirmation_email_error = null
    where id = v_booking.id;

    update public.booking_confirmation_tokens as bct
    set confirmed_at = now()
    where bct.booking_id = v_booking.id;

    v_newly_confirmed := true;
  elsif v_booking.status not in ('confirmed', 'checked_in', 'completed') then
    raise exception 'This reservation is no longer active' using errcode = 'P0001';
  end if;

  if v_newly_confirmed then
    insert into public.qr_access_passes (booking_id, token_hash, expires_at)
    values (v_booking.id, p_access_token_hash, v_booking.ends_at + interval '1 hour')
    on conflict on constraint qr_access_passes_booking_id_key do update
      set token_hash = excluded.token_hash,
          expires_at = excluded.expires_at,
          revoked_at = null;
  end if;

  return query
  select b.id, b.reservation_code, b.guest_name, b.guest_email, b.starts_at,
         b.ends_at, b.seat_ids, b.subtotal_cents,
         b.confirmation_email_sent_at, v_newly_confirmed
  from public.bookings b
  where b.id = v_booking.id;
end;
$$;
