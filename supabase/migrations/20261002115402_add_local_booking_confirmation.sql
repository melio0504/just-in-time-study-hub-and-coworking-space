create table public.booking_confirmation_tokens (
  booking_id uuid primary key references public.bookings (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint booking_confirmation_tokens_hash_format
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint booking_confirmation_tokens_expiry_order
    check (expires_at > created_at)
);

alter table public.booking_confirmation_tokens enable row level security;

revoke all on public.booking_confirmation_tokens from public, anon, authenticated;
grant select, insert, update on public.booking_confirmation_tokens to service_role;

create or replace function private.create_booking_confirmation_token(
  p_booking_id uuid,
  p_user_id uuid,
  p_token_hash text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
begin
  if p_user_id is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid booking confirmation request' using errcode = '22023';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id and user_id = p_user_id
  for update;

  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;
  if v_booking.status <> 'pending' or v_booking.payment_status <> 'pending' then
    raise exception 'This booking can no longer be confirmed' using errcode = 'P0001';
  end if;
  if v_booking.hold_expires_at is null or v_booking.hold_expires_at <= now() then
    raise exception 'The seat hold expired. Please create a new reservation.' using errcode = 'P0001';
  end if;

  insert into public.booking_confirmation_tokens (booking_id, token_hash, expires_at)
  values (v_booking.id, p_token_hash, v_booking.hold_expires_at)
  on conflict (booking_id) do update
    set token_hash = excluded.token_hash,
        expires_at = excluded.expires_at,
        confirmed_at = null,
        created_at = now();
end;
$$;

create or replace function public.create_booking_confirmation_token(
  p_booking_id uuid,
  p_user_id uuid,
  p_token_hash text
) returns void
language sql
security invoker
set search_path = ''
as $$
  select private.create_booking_confirmation_token(p_booking_id, p_user_id, p_token_hash);
$$;

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

create or replace function public.confirm_booking_from_token(
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
language sql
security invoker
set search_path = ''
as $$
  select * from private.confirm_booking_from_token(p_token_hash, p_access_token_hash);
$$;

revoke execute on function private.create_booking_confirmation_token(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke execute on function private.confirm_booking_from_token(text, text)
  from public, anon, authenticated, service_role;
revoke execute on function public.create_booking_confirmation_token(uuid, uuid, text)
  from public, anon, authenticated;
revoke execute on function public.confirm_booking_from_token(text, text)
  from public, anon, authenticated;

grant execute on function private.create_booking_confirmation_token(uuid, uuid, text) to service_role;
grant execute on function private.confirm_booking_from_token(text, text) to service_role;
grant execute on function public.create_booking_confirmation_token(uuid, uuid, text) to service_role;
grant execute on function public.confirm_booking_from_token(text, text) to service_role;

comment on table public.booking_confirmation_tokens is
  'Server-only one-time tokens for confirming local QR reservations. Raw tokens are never stored.';
comment on function public.confirm_booking_from_token(text, text) is
  'Server-only atomic local QR confirmation and kiosk access-pass issuance.';
