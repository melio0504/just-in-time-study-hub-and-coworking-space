-- Customer cancellations use a server-only two-phase refund workflow. The
-- provider call is outside Postgres, while this table and the RPCs below keep
-- retries idempotent and make the provider state visible to the customer.

create table public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete restrict,
  payment_id uuid not null references public.payments (id) on delete restrict,
  provider_refund_id text unique,
  idempotency_key text not null unique,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'PHP' check (currency = 'PHP'),
  status text not null check (status in ('processing', 'pending', 'succeeded', 'failed')),
  reason text not null default 'requested_by_customer',
  failure_code text,
  failure_message text,
  provider_payload jsonb not null default '{}'::jsonb,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payment_refunds_payment_id_idx on public.payment_refunds (payment_id);
create index payment_refunds_pending_idx on public.payment_refunds (updated_at)
where status in ('processing', 'pending');

create trigger payment_refunds_set_updated_at
before update on public.payment_refunds
for each row execute function private.set_updated_at();

alter table public.payment_refunds enable row level security;
grant select on public.payment_refunds to authenticated;

create policy "Users read own refunds; reservation staff read all"
on public.payment_refunds for select to authenticated using (
  exists (
    select 1
    from public.bookings b
    where b.id = payment_refunds.booking_id
      and (
        b.user_id = (select auth.uid())
        or (select private.has_staff_permission('reservations'))
      )
  )
);

create function private.prepare_customer_booking_cancellation(
  p_booking_id uuid,
  p_user_id uuid
)
returns table (
  booking_id uuid,
  reservation_code text,
  requires_refund boolean,
  refund_id uuid,
  idempotency_key text,
  provider_payment_id text,
  payment_livemode boolean,
  amount_cents bigint,
  refund_status text,
  provider_refund_id text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_payment public.payments%rowtype;
  v_refund public.payment_refunds%rowtype;
begin
  if p_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select b.* into v_booking
  from public.bookings b
  where b.id = p_booking_id and b.user_id = p_user_id
  for update;

  if not found then
    raise exception 'Reservation not found' using errcode = 'P0002';
  end if;

  -- A client may retry after the provider accepted the request but before the
  -- response reached the browser. Return the same refund operation.
  if v_booking.status = 'cancelled' then
    select r.* into v_refund
    from public.payment_refunds r
    where r.booking_id = v_booking.id;

    if found then
      select p.* into v_payment
      from public.payments p
      where p.id = v_refund.payment_id;
      return query select v_booking.id, v_booking.reservation_code, true,
        v_refund.id, v_refund.idempotency_key, v_payment.provider_payment_id,
        coalesce(v_payment.livemode, false), v_refund.amount_cents,
        v_refund.status, v_refund.provider_refund_id;
      return;
    end if;
    raise exception 'Reservation is already cancelled' using errcode = 'P0001';
  end if;

  if v_booking.status not in ('pending', 'confirmed') or v_booking.starts_at <= now() then
    raise exception 'Reservation cannot be cancelled' using errcode = 'P0001';
  end if;

  if v_booking.payment_status <> 'paid' then
    update public.bookings b
    set status = 'cancelled',
        cancelled_at = now(),
        cancellation_reason = 'Cancelled by customer',
        updated_at = now()
    where b.id = v_booking.id;

    update public.qr_access_passes q
    set revoked_at = coalesce(q.revoked_at, now())
    where q.booking_id = v_booking.id;

    insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
    values (p_user_id, 'Cancelled own reservation', 'booking', v_booking.id::text,
      jsonb_build_object('reservation_code', v_booking.reservation_code, 'refund_required', false));

    return query select v_booking.id, v_booking.reservation_code, false,
      null::uuid, null::text, null::text, null::boolean, null::bigint, null::text, null::text;
    return;
  end if;

  select p.* into v_payment
  from public.payments p
  where p.booking_id = v_booking.id
    and p.status = 'paid'
  order by p.paid_at desc nulls last, p.created_at desc
  limit 1
  for update;

  if not found or v_payment.provider_payment_id is null then
    raise exception 'The paid transaction cannot be refunded automatically' using errcode = 'P0001';
  end if;

  insert into public.payment_refunds (
    booking_id, payment_id, idempotency_key, amount_cents, currency, status
  ) values (
    v_booking.id,
    v_payment.id,
    'booking-refund/' || v_booking.id::text,
    v_payment.amount_cents,
    v_payment.currency,
    'processing'
  )
  on conflict on constraint payment_refunds_booking_id_key do nothing;

  select r.* into v_refund
  from public.payment_refunds r
  where r.booking_id = v_booking.id
  for update;

  if v_refund.status = 'failed' and v_refund.provider_refund_id is null then
    update public.payment_refunds r
    set status = 'processing', failure_code = null, failure_message = null
    where r.id = v_refund.id
    returning r.* into v_refund;
  end if;

  return query select v_booking.id, v_booking.reservation_code, true,
    v_refund.id, v_refund.idempotency_key, v_payment.provider_payment_id,
    coalesce(v_payment.livemode, false), v_refund.amount_cents,
    v_refund.status, v_refund.provider_refund_id;
end;
$$;

create function private.finalize_customer_booking_refund(
  p_refund_id uuid,
  p_provider_refund_id text,
  p_status text,
  p_failure_code text default null,
  p_failure_message text default null,
  p_provider_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking_id uuid;
  v_payment_id uuid;
  v_booking public.bookings%rowtype;
  v_payment public.payments%rowtype;
  v_refund public.payment_refunds%rowtype;
begin
  if p_status not in ('processing', 'pending', 'succeeded', 'failed') then
    raise exception 'Unsupported refund status' using errcode = '22023';
  end if;

  select r.booking_id, r.payment_id into v_booking_id, v_payment_id
  from public.payment_refunds r where r.id = p_refund_id;
  if not found then
    raise exception 'Refund not found' using errcode = 'P0002';
  end if;

  -- Use the same lock order as preparation: booking, payment, then refund.
  select b.* into v_booking from public.bookings b where b.id = v_booking_id for update;
  select p.* into v_payment from public.payments p where p.id = v_payment_id for update;
  select r.* into v_refund from public.payment_refunds r where r.id = p_refund_id for update;

  if v_refund.provider_refund_id is not null
     and p_provider_refund_id is distinct from v_refund.provider_refund_id then
    raise exception 'Refund provider identifier mismatch' using errcode = '22023';
  end if;

  update public.payment_refunds r
  set provider_refund_id = coalesce(r.provider_refund_id, nullif(p_provider_refund_id, '')),
      status = p_status,
      failure_code = p_failure_code,
      failure_message = left(p_failure_message, 1000),
      provider_payload = coalesce(p_provider_payload, '{}'::jsonb),
      finalized_at = case when p_status in ('succeeded', 'failed') then now() else r.finalized_at end
  where r.id = v_refund.id;

  if p_status in ('processing', 'pending', 'succeeded') then
    update public.bookings b
    set status = 'cancelled',
        payment_status = case when p_status = 'succeeded' then 'refunded'::public.payment_status else 'processing'::public.payment_status end,
        cancelled_at = coalesce(b.cancelled_at, now()),
        cancellation_reason = 'Cancelled by customer; full refund requested',
        updated_at = now()
    where b.id = v_booking.id;

    update public.payments p
    set status = case when p_status = 'succeeded' then 'refunded'::public.payment_status else 'processing'::public.payment_status end,
        refunded_at = case when p_status = 'succeeded' then coalesce(p.refunded_at, now()) else p.refunded_at end,
        failure_code = null,
        failure_message = null,
        updated_at = now()
    where p.id = v_payment.id;

    update public.qr_access_passes q
    set revoked_at = coalesce(q.revoked_at, now())
    where q.booking_id = v_booking.id;
  elsif p_status = 'failed' then
    update public.bookings b
    set payment_status = 'paid', updated_at = now()
    where b.id = v_booking.id and b.status = 'cancelled';

    update public.payments p
    set status = 'paid', failure_code = p_failure_code,
        failure_message = left(p_failure_message, 1000), updated_at = now()
    where p.id = v_payment.id;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (
    v_booking.user_id,
    case when p_status = 'failed' then 'Customer refund failed' else 'Customer refund updated' end,
    'payment_refund',
    v_refund.id::text,
    jsonb_build_object(
      'booking_id', v_booking.id,
      'reservation_code', v_booking.reservation_code,
      'status', p_status,
      'provider_refund_id', p_provider_refund_id,
      'amount_cents', v_refund.amount_cents
    )
  );
end;
$$;

create function private.process_paymongo_refund_event(
  p_event_id text,
  p_event_type text,
  p_refund_id text,
  p_status text,
  p_livemode boolean,
  p_payload jsonb,
  p_internal_refund_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_refund_id uuid;
  v_livemode boolean;
begin
  insert into public.payment_webhook_events (id, event_type, payload)
  values (p_event_id, p_event_type, p_payload)
  on conflict (id) do nothing;

  if not found then
    return;
  end if;

  select r.id, coalesce(p.livemode, false) into v_refund_id, v_livemode
  from public.payment_refunds r
  join public.payments p on p.id = r.payment_id
  where r.provider_refund_id = p_refund_id
     or (r.id = p_internal_refund_id and r.provider_refund_id is null)
  order by (r.provider_refund_id = p_refund_id) desc
  limit 1;

  if not found then
    update public.payment_webhook_events
    set processing_error = 'Refund does not match a customer cancellation'
    where id = p_event_id;
    return;
  end if;
  if v_livemode is distinct from p_livemode then
    update public.payment_webhook_events
    set processing_error = 'Refund environment does not match its payment'
    where id = p_event_id;
    return;
  end if;

  perform private.finalize_customer_booking_refund(
    v_refund_id,
    p_refund_id,
    p_status,
    case when p_status = 'failed' then 'provider_refund_failed' else null end,
    case when p_status = 'failed' then 'PayMongo could not complete the refund' else null end,
    p_payload
  );

  update public.payment_webhook_events set processed_at = now() where id = p_event_id;
end;
$$;

create function private.get_customer_booking_pass(p_booking_id uuid, p_user_id uuid)
returns table (
  booking_id uuid,
  reservation_code text,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.reservation_code, q.expires_at
  from public.bookings b
  join public.qr_access_passes q on q.booking_id = b.id
  where b.id = p_booking_id
    and b.user_id = p_user_id
    and b.payment_status in ('paid', 'refunded');
$$;

create function public.prepare_customer_booking_cancellation(p_booking_id uuid, p_user_id uuid)
returns table (
  booking_id uuid,
  reservation_code text,
  requires_refund boolean,
  refund_id uuid,
  idempotency_key text,
  provider_payment_id text,
  payment_livemode boolean,
  amount_cents bigint,
  refund_status text,
  provider_refund_id text
)
language sql security invoker set search_path = ''
as $$ select * from private.prepare_customer_booking_cancellation(p_booking_id, p_user_id); $$;

create function public.finalize_customer_booking_refund(
  p_refund_id uuid,
  p_provider_refund_id text,
  p_status text,
  p_failure_code text default null,
  p_failure_message text default null,
  p_provider_payload jsonb default '{}'::jsonb
)
returns void language sql security invoker set search_path = ''
as $$ select private.finalize_customer_booking_refund(p_refund_id, p_provider_refund_id, p_status, p_failure_code, p_failure_message, p_provider_payload); $$;

create function public.process_paymongo_refund_event(
  p_event_id text,
  p_event_type text,
  p_refund_id text,
  p_status text,
  p_livemode boolean,
  p_payload jsonb,
  p_internal_refund_id uuid default null
)
returns void language sql security invoker set search_path = ''
as $$ select private.process_paymongo_refund_event(p_event_id, p_event_type, p_refund_id, p_status, p_livemode, p_payload, p_internal_refund_id); $$;

create function public.get_customer_booking_pass(p_booking_id uuid, p_user_id uuid)
returns table (booking_id uuid, reservation_code text, expires_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.get_customer_booking_pass(p_booking_id, p_user_id); $$;

revoke all on function private.prepare_customer_booking_cancellation(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function private.finalize_customer_booking_refund(uuid, text, text, text, text, jsonb) from public, anon, authenticated, service_role;
revoke all on function private.process_paymongo_refund_event(text, text, text, text, boolean, jsonb, uuid) from public, anon, authenticated, service_role;
revoke all on function private.get_customer_booking_pass(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.prepare_customer_booking_cancellation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.finalize_customer_booking_refund(uuid, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.process_paymongo_refund_event(text, text, text, text, boolean, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.get_customer_booking_pass(uuid, uuid) from public, anon, authenticated;

grant execute on function private.prepare_customer_booking_cancellation(uuid, uuid) to service_role;
grant execute on function private.finalize_customer_booking_refund(uuid, text, text, text, text, jsonb) to service_role;
grant execute on function private.process_paymongo_refund_event(text, text, text, text, boolean, jsonb, uuid) to service_role;
grant execute on function private.get_customer_booking_pass(uuid, uuid) to service_role;
grant execute on function public.prepare_customer_booking_cancellation(uuid, uuid) to service_role;
grant execute on function public.finalize_customer_booking_refund(uuid, text, text, text, text, jsonb) to service_role;
grant execute on function public.process_paymongo_refund_event(text, text, text, text, boolean, jsonb, uuid) to service_role;
grant execute on function public.get_customer_booking_pass(uuid, uuid) to service_role;

comment on table public.payment_refunds is
  'Idempotent PayMongo full-refund operations created by customer reservation cancellation.';
comment on function public.prepare_customer_booking_cancellation(uuid, uuid) is
  'Server-only ownership and eligibility check that cancels unpaid reservations or prepares one idempotent paid refund.';
