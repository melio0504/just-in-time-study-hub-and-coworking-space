create or replace function private.get_booking_confirmation_preview(
  p_token_hash text
) returns table (
  reservation_code text,
  guest_name text,
  guest_email text,
  starts_at timestamptz,
  ends_at timestamptz,
  seat_ids text[],
  subtotal_cents bigint,
  expires_at timestamptz,
  confirmed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid confirmation token' using errcode = '22023';
  end if;

  return query
  select b.reservation_code,
         b.guest_name,
         b.guest_email,
         b.starts_at,
         b.ends_at,
         b.seat_ids,
         b.subtotal_cents,
         t.expires_at,
         t.confirmed_at is not null
  from public.booking_confirmation_tokens as t
  join public.bookings as b on b.id = t.booking_id
  where t.token_hash = p_token_hash
    and (t.confirmed_at is not null or t.expires_at > now())
    and b.status in ('pending', 'confirmed', 'checked_in', 'completed');

  if not found then
    raise exception 'This payment link is invalid or has expired' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.get_booking_confirmation_preview(
  p_token_hash text
) returns table (
  reservation_code text,
  guest_name text,
  guest_email text,
  starts_at timestamptz,
  ends_at timestamptz,
  seat_ids text[],
  subtotal_cents bigint,
  expires_at timestamptz,
  confirmed boolean
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.get_booking_confirmation_preview(p_token_hash);
$$;

revoke execute on function private.get_booking_confirmation_preview(text)
  from public, anon, authenticated, service_role;
revoke execute on function public.get_booking_confirmation_preview(text)
  from public, anon, authenticated;

grant execute on function private.get_booking_confirmation_preview(text) to service_role;
grant execute on function public.get_booking_confirmation_preview(text) to service_role;

comment on function public.get_booking_confirmation_preview(text) is
  'Server-only lookup for the simulated GCash payment screen. Accepts a SHA-256 token hash, never a raw stored token.';
