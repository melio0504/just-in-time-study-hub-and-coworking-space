-- PayMongo dynamic QR Ph payments. Provider credentials and webhook handling
-- stay in Edge Functions; these RPCs only perform short, atomic state changes.

alter table public.payments
  add column provider_payment_intent_id text,
  add column provider_payment_method_id text,
  add column provider_status text,
  add column qr_expires_at timestamptz,
  add column livemode boolean;

create unique index payments_booking_id_key
  on public.payments (booking_id);
create unique index payments_provider_payment_intent_id_key
  on public.payments (provider_payment_intent_id)
  where provider_payment_intent_id is not null;
create unique index payments_provider_payment_method_id_key
  on public.payments (provider_payment_method_id)
  where provider_payment_method_id is not null;

create or replace function private.prepare_paymongo_payment(
  p_booking_id uuid,
  p_user_id uuid
) returns table (
  booking_id uuid,
  reservation_code text,
  guest_name text,
  guest_email text,
  seat_ids text[],
  starts_at timestamptz,
  ends_at timestamptz,
  amount_cents bigint,
  payment_id uuid,
  payment_status public.payment_status,
  provider_payment_intent_id text,
  provider_payment_method_id text,
  provider_status text,
  qr_expires_at timestamptz,
  livemode boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_payment public.payments%rowtype;
begin
  if p_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id and user_id = p_user_id
  for update;

  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;
  if v_booking.status <> 'pending' or v_booking.payment_status <> 'pending' then
    raise exception 'This booking can no longer accept payment' using errcode = 'P0001';
  end if;
  if v_booking.hold_expires_at is null or v_booking.hold_expires_at <= now() then
    raise exception 'The seat hold expired. Please create a new reservation.' using errcode = 'P0001';
  end if;
  if v_booking.subtotal_cents < 100 then
    raise exception 'QR Ph requires a minimum payment of PHP 1.00' using errcode = '22023';
  end if;

  insert into public.payments (booking_id, method, status, amount_cents, currency)
  values (v_booking.id, 'qrph', 'pending', v_booking.subtotal_cents, 'PHP')
  on conflict do nothing;

  select * into strict v_payment
  from public.payments as p
  where p.booking_id = v_booking.id
  for update;

  if v_payment.amount_cents <> v_booking.subtotal_cents or v_payment.currency <> 'PHP' then
    raise exception 'The stored payment amount does not match the booking' using errcode = 'P0001';
  end if;
  if v_payment.status not in ('pending', 'processing') then
    raise exception 'This payment can no longer generate a QR code' using errcode = 'P0001';
  end if;

  return query select
    v_booking.id,
    v_booking.reservation_code,
    v_booking.guest_name,
    v_booking.guest_email,
    v_booking.seat_ids,
    v_booking.starts_at,
    v_booking.ends_at,
    v_booking.subtotal_cents,
    v_payment.id,
    v_payment.status,
    v_payment.provider_payment_intent_id,
    v_payment.provider_payment_method_id,
    v_payment.provider_status,
    v_payment.qr_expires_at,
    v_payment.livemode;
end;
$$;

create or replace function public.prepare_paymongo_payment(
  p_booking_id uuid,
  p_user_id uuid
) returns table (
  booking_id uuid,
  reservation_code text,
  guest_name text,
  guest_email text,
  seat_ids text[],
  starts_at timestamptz,
  ends_at timestamptz,
  amount_cents bigint,
  payment_id uuid,
  payment_status public.payment_status,
  provider_payment_intent_id text,
  provider_payment_method_id text,
  provider_status text,
  qr_expires_at timestamptz,
  livemode boolean
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.prepare_paymongo_payment(p_booking_id, p_user_id);
$$;

create or replace function private.save_paymongo_qr(
  p_booking_id uuid,
  p_user_id uuid,
  p_payment_intent_id text,
  p_payment_method_id text,
  p_provider_status text,
  p_qr_expires_at timestamptz,
  p_livemode boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
begin
  if p_user_id is null
     or p_payment_intent_id !~ '^pi_[A-Za-z0-9]+$'
     or p_payment_method_id !~ '^pm_[A-Za-z0-9]+$'
     or p_qr_expires_at <= now()
     or p_qr_expires_at > now() + interval '3 hours' then
    raise exception 'Invalid PayMongo QR details' using errcode = '22023';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id and user_id = p_user_id
  for update;

  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;
  if v_booking.status <> 'pending' or v_booking.payment_status <> 'pending' then
    raise exception 'This booking can no longer accept payment' using errcode = 'P0001';
  end if;

  update public.payments
  set provider_payment_intent_id = p_payment_intent_id,
      provider_payment_method_id = p_payment_method_id,
      provider_status = left(p_provider_status, 80),
      qr_expires_at = p_qr_expires_at,
      livemode = p_livemode,
      status = 'processing',
      failure_code = null,
      failure_message = null
  where booking_id = v_booking.id
    and amount_cents = v_booking.subtotal_cents
    and currency = 'PHP';

  if not found then
    raise exception 'Payment record not found' using errcode = 'P0002';
  end if;

  -- Keep the seat for a short webhook reconciliation window after the QR
  -- stops accepting scans. The customer-facing countdown remains 15 minutes.
  update public.bookings
  set hold_expires_at = greatest(
    coalesce(hold_expires_at, p_qr_expires_at),
    p_qr_expires_at + interval '2 minutes'
  )
  where id = v_booking.id;
end;
$$;

create or replace function public.save_paymongo_qr(
  p_booking_id uuid,
  p_user_id uuid,
  p_payment_intent_id text,
  p_payment_method_id text,
  p_provider_status text,
  p_qr_expires_at timestamptz,
  p_livemode boolean
) returns void
language sql
security invoker
set search_path = ''
as $$
  select private.save_paymongo_qr(
    p_booking_id,
    p_user_id,
    p_payment_intent_id,
    p_payment_method_id,
    p_provider_status,
    p_qr_expires_at,
    p_livemode
  );
$$;

create or replace function private.process_paymongo_event(
  p_event_id text,
  p_event_type text,
  p_livemode boolean,
  p_payment_intent_id text,
  p_payment_id text,
  p_amount_cents bigint,
  p_currency text,
  p_paid_at timestamptz,
  p_payload jsonb,
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
  newly_confirmed boolean,
  requires_review boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_booking public.bookings%rowtype;
  v_newly_confirmed boolean := false;
  v_requires_review boolean := false;
  v_active_seats integer;
begin
  if p_event_id !~ '^evt_[A-Za-z0-9_-]+$'
     or p_event_type not in ('payment.paid', 'payment.failed', 'qrph.expired')
     or p_payment_intent_id !~ '^pi_[A-Za-z0-9]+$'
     or p_access_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid PayMongo event' using errcode = '22023';
  end if;

  insert into public.payment_webhook_events (id, event_type, payload)
  values (p_event_id, p_event_type, p_payload)
  on conflict (id) do update
    set payload = excluded.payload;

  select * into v_payment
  from public.payments
  where provider_payment_intent_id = p_payment_intent_id
  for update;

  if not found then
    raise exception 'Unknown PayMongo payment intent' using errcode = 'P0002';
  end if;
  if v_payment.livemode is distinct from p_livemode then
    raise exception 'PayMongo environment mismatch' using errcode = 'P0001';
  end if;

  select * into v_booking
  from public.bookings
  where id = v_payment.booking_id
  for update;

  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  if p_event_type = 'payment.paid' then
    if p_payment_id !~ '^pay_[A-Za-z0-9]+$'
       or p_amount_cents is distinct from v_payment.amount_cents
       or upper(coalesce(p_currency, '')) <> v_payment.currency
       or p_paid_at is null then
      raise exception 'PayMongo payment verification failed' using errcode = 'P0001';
    end if;

    update public.payments
    set status = 'paid',
        provider_status = 'succeeded',
        provider_payment_id = p_payment_id,
        paid_at = p_paid_at,
        failure_code = null,
        failure_message = null
    where id = v_payment.id;

    if v_booking.status = 'pending' and v_booking.payment_status in ('pending', 'processing') then
      select count(*) into v_active_seats
      from public.booking_seats as bs
      where bs.booking_id = v_booking.id and bs.active;

      if v_active_seats = cardinality(v_booking.seat_ids) then
        update public.bookings
        set status = 'confirmed',
            payment_status = 'paid',
            hold_expires_at = null,
            confirmation_email_error = null
        where id = v_booking.id;

        insert into public.qr_access_passes (booking_id, token_hash, expires_at)
        values (v_booking.id, p_access_token_hash, v_booking.ends_at + interval '1 hour')
        on conflict on constraint qr_access_passes_booking_id_key do update
          set token_hash = excluded.token_hash,
              expires_at = excluded.expires_at,
              revoked_at = null;

        v_newly_confirmed := true;
      else
        update public.bookings set payment_status = 'paid' where id = v_booking.id;
        update public.payments
        set failure_code = 'paid_after_seat_release',
            failure_message = 'Payment succeeded after the reservation seats were released; manual reconciliation is required.'
        where id = v_payment.id;
        v_requires_review := true;
      end if;
    elsif v_booking.status in ('confirmed', 'checked_in', 'completed') then
      update public.bookings set payment_status = 'paid' where id = v_booking.id;
    else
      update public.bookings set payment_status = 'paid' where id = v_booking.id;
      update public.payments
      set failure_code = 'paid_in_inactive_booking',
          failure_message = 'Payment succeeded for an inactive reservation; manual reconciliation is required.'
      where id = v_payment.id;
      v_requires_review := true;
    end if;
  else
    if v_payment.status <> 'paid' then
      update public.payments
      set status = 'failed',
          provider_status = case when p_event_type = 'qrph.expired' then 'expired' else 'failed' end,
          failure_code = case when p_event_type = 'qrph.expired' then 'qrph_expired' else 'payment_failed' end,
          failure_message = case when p_event_type = 'qrph.expired'
            then 'The QR Ph code expired before payment completed.'
            else 'PayMongo reported that the payment failed.'
          end
      where id = v_payment.id;

      if v_booking.status = 'pending' and v_booking.payment_status <> 'paid' then
        update public.bookings
        set status = 'declined',
            payment_status = 'failed',
            hold_expires_at = null
        where id = v_booking.id;
      end if;
    end if;
  end if;

  update public.payment_webhook_events
  set processed_at = now(),
      processing_error = case when v_requires_review
        then 'Manual reconciliation required for a successful payment.'
        else null
      end
  where id = p_event_id;

  return query
  select b.id,
         b.reservation_code,
         b.guest_name,
         b.guest_email,
         b.starts_at,
         b.ends_at,
         b.seat_ids,
         b.subtotal_cents,
         b.confirmation_email_sent_at,
         v_newly_confirmed,
         v_requires_review
  from public.bookings b
  where b.id = v_booking.id;
end;
$$;

create or replace function public.process_paymongo_event(
  p_event_id text,
  p_event_type text,
  p_livemode boolean,
  p_payment_intent_id text,
  p_payment_id text,
  p_amount_cents bigint,
  p_currency text,
  p_paid_at timestamptz,
  p_payload jsonb,
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
  newly_confirmed boolean,
  requires_review boolean
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.process_paymongo_event(
    p_event_id,
    p_event_type,
    p_livemode,
    p_payment_intent_id,
    p_payment_id,
    p_amount_cents,
    p_currency,
    p_paid_at,
    p_payload,
    p_access_token_hash
  );
$$;

revoke execute on function private.prepare_paymongo_payment(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke execute on function private.save_paymongo_qr(uuid, uuid, text, text, text, timestamptz, boolean)
  from public, anon, authenticated, service_role;
revoke execute on function private.process_paymongo_event(text, text, boolean, text, text, bigint, text, timestamptz, jsonb, text)
  from public, anon, authenticated, service_role;
revoke execute on function public.prepare_paymongo_payment(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.save_paymongo_qr(uuid, uuid, text, text, text, timestamptz, boolean)
  from public, anon, authenticated;
revoke execute on function public.process_paymongo_event(text, text, boolean, text, text, bigint, text, timestamptz, jsonb, text)
  from public, anon, authenticated;

grant execute on function private.prepare_paymongo_payment(uuid, uuid) to service_role;
grant execute on function private.save_paymongo_qr(uuid, uuid, text, text, text, timestamptz, boolean) to service_role;
grant execute on function private.process_paymongo_event(text, text, boolean, text, text, bigint, text, timestamptz, jsonb, text) to service_role;
grant execute on function public.prepare_paymongo_payment(uuid, uuid) to service_role;
grant execute on function public.save_paymongo_qr(uuid, uuid, text, text, text, timestamptz, boolean) to service_role;
grant execute on function public.process_paymongo_event(text, text, boolean, text, text, bigint, text, timestamptz, jsonb, text) to service_role;

comment on column public.payments.provider_payment_intent_id is
  'PayMongo Payment Intent identifier. Unique and server-written.';
comment on column public.payments.qr_expires_at is
  'PayMongo QR Ph scan deadline; the seat hold includes a short reconciliation grace period.';
comment on function public.process_paymongo_event(text, text, boolean, text, text, bigint, text, timestamptz, jsonb, text) is
  'Server-only atomic PayMongo webhook finalization and kiosk-pass issuance.';
