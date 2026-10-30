-- Closing an unpaid QR Ph checkout is an abandonment, not a customer
-- cancellation. Keep the failed payment attempt for webhook reconciliation and
-- auditability, but release its seats and keep it out of reservation history.

create or replace function private.prepare_booking_abandonment(
  p_booking_id uuid,
  p_user_id uuid
)
returns table (
  booking_id uuid,
  reservation_code text,
  booking_status public.booking_status,
  booking_payment_status public.payment_status,
  payment_status public.payment_status,
  provider_payment_intent_id text,
  payment_livemode boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  return query
  select
    b.id,
    b.reservation_code,
    b.status,
    b.payment_status,
    p.status,
    p.provider_payment_intent_id,
    p.livemode
  from public.bookings b
  left join public.payments p on p.booking_id = b.id
  where b.id = p_booking_id and b.user_id = p_user_id;

  if not found then
    raise exception 'Reservation not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.prepare_booking_abandonment(
  p_booking_id uuid,
  p_user_id uuid
)
returns table (
  booking_id uuid,
  reservation_code text,
  booking_status public.booking_status,
  booking_payment_status public.payment_status,
  payment_status public.payment_status,
  provider_payment_intent_id text,
  payment_livemode boolean
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.prepare_booking_abandonment(p_booking_id, p_user_id);
$$;

create or replace function private.abandon_unpaid_booking(
  p_booking_id uuid,
  p_user_id uuid
)
returns text
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

  -- Match the PayMongo webhook lock order so a payment and an abandonment
  -- cannot finalize the same reservation concurrently.
  select p.* into v_payment
  from public.payments p
  where p.booking_id = p_booking_id
  for update;

  select b.* into v_booking
  from public.bookings b
  where b.id = p_booking_id
  for update;

  if not found or v_booking.user_id is distinct from p_user_id then
    raise exception 'Reservation not found' using errcode = 'P0002';
  end if;

  if v_booking.status not in ('pending', 'declined')
     or v_booking.payment_status = 'paid'
     or (v_payment.id is not null and v_payment.status in ('paid', 'refunded')) then
    raise exception 'This reservation can no longer be abandoned' using errcode = 'P0001';
  end if;

  update public.payments p
  set status = 'failed',
      provider_status = 'cancelled',
      failure_code = 'payment_abandoned',
      failure_message = 'The customer closed the QR Ph checkout before paying.',
      updated_at = now()
  where p.id = v_payment.id;

  update public.bookings b
  set status = 'declined',
      payment_status = 'failed',
      hold_expires_at = null,
      cancelled_at = null,
      cancellation_reason = null,
      updated_at = now()
  where b.id = v_booking.id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (
    p_user_id,
    'Abandoned unpaid QR Ph checkout',
    'booking',
    v_booking.id::text,
    jsonb_build_object('reservation_code', v_booking.reservation_code)
  );

  return v_booking.reservation_code;
end;
$$;

create or replace function public.abandon_unpaid_booking(
  p_booking_id uuid,
  p_user_id uuid
)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.abandon_unpaid_booking(p_booking_id, p_user_id);
$$;

comment on function public.abandon_unpaid_booking(uuid, uuid) is
  'Server-only transition that releases an owned unpaid QR Ph checkout without classifying it as a cancelled reservation.';

revoke execute on function private.prepare_booking_abandonment(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.prepare_booking_abandonment(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function private.abandon_unpaid_booking(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.abandon_unpaid_booking(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.abandon_unpaid_booking(uuid, uuid) to service_role;
grant execute on function public.abandon_unpaid_booking(uuid, uuid) to service_role;
grant execute on function private.prepare_booking_abandonment(uuid, uuid) to service_role;
grant execute on function public.prepare_booking_abandonment(uuid, uuid) to service_role;
