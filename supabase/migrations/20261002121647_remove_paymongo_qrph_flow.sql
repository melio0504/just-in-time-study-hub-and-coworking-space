drop function if exists public.process_paymongo_event(
  text, text, uuid, text, text, bigint, text, jsonb, text
);
drop function if exists private.process_paymongo_event(
  text, text, uuid, text, text, bigint, text, jsonb, text
);

drop index if exists public.payments_provider_payment_intent_id_key;
drop index if exists public.payments_booking_id_key;

alter table public.payments
  drop column if exists provider_payment_intent_id,
  drop column if exists provider_payment_method_id,
  drop column if exists qr_expires_at;

comment on table public.payment_webhook_events is
  'Reserved server-only event log for a future payment provider integration.';
