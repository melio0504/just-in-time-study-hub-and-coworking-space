-- A customer may release an unpaid seat hold, but the close action must not
-- overwrite a payment that the webhook has already finalized. Paid bookings
-- require the refund/reconciliation flow and cannot use the customer RPC.
create or replace function private.cancel_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.bookings
  set status = 'cancelled',
      cancelled_at = now(),
      cancellation_reason = 'Cancelled by customer'
  where id = p_booking_id
    and user_id = (select auth.uid())
    and status in ('pending', 'confirmed')
    and payment_status <> 'paid'
    and starts_at > now();

  if not found then
    raise exception 'Booking cannot be cancelled' using errcode = 'P0001';
  end if;
end;
$$;

comment on function public.cancel_booking(uuid) is
  'Cancels the calling customer''s future unpaid booking and releases its active seat reservations.';
