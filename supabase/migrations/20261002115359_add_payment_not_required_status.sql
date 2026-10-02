alter type public.payment_status add value if not exists 'not_required';

comment on type public.payment_status is
  'Payment lifecycle. not_required is used for reservations confirmed by the local QR flow.';
