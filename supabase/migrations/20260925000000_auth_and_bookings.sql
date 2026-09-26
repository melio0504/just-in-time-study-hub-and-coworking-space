-- Just In Time Study Hub: initial production schema.
-- Customer-entered reservation times are interpreted in Asia/Manila.

create extension if not exists btree_gist with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.profile_role as enum ('customer', 'staff', 'admin');
create type public.seat_status as enum ('available', 'reserved', 'occupied', 'maintenance');
create type public.booking_status as enum ('pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'declined', 'no_show');
create type public.payment_status as enum ('pending', 'processing', 'paid', 'failed', 'refunded');
create type public.payment_method as enum ('gcash', 'qrph');
create type public.check_in_status as enum ('checked_in', 'checked_out', 'overtime', 'no_show');
create type public.content_status as enum ('draft', 'published', 'archived');
create type public.flashcard_rating as enum ('learned', 'needs_review');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  phone text check (phone is null or char_length(phone) <= 32),
  avatar_url text,
  role public.profile_role not null default 'customer',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.seats (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z]{2}[0-9]{2}$'),
  name text not null check (char_length(name) between 1 and 80),
  zone text not null check (char_length(zone) between 1 and 80),
  seat_type text not null default 'study-seat' check (char_length(seat_type) <= 80),
  hourly_rate_cents bigint not null default 0 check (hourly_rate_cents >= 0),
  status public.seat_status not null default 'available',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  reservation_code text not null unique,
  user_id uuid not null references public.profiles (id) on delete restrict,
  guest_name text not null check (char_length(guest_name) between 1 and 120),
  guest_email text not null check (guest_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  booking_date date not null,
  start_time time not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  duration_hours smallint not null check (duration_hours between 1 and 24),
  space text not null default 'study-seat' check (char_length(space) <= 80),
  seat_ids text[] not null check (cardinality(seat_ids) between 1 and 5),
  status public.booking_status not null default 'pending',
  payment_status public.payment_status not null default 'pending',
  subtotal_cents bigint not null default 0 check (subtotal_cents >= 0),
  hold_expires_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_valid_window check (ends_at > starts_at),
  constraint bookings_date_matches_start check (booking_date = (starts_at at time zone 'Asia/Manila')::date)
);

create table public.booking_seats (
  booking_id uuid not null references public.bookings (id) on delete cascade,
  seat_id uuid not null references public.seats (id) on delete restrict,
  reserved_during tstzrange not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (booking_id, seat_id),
  constraint booking_seats_nonempty_range check (not isempty(reserved_during)),
  constraint booking_seats_no_overlap exclude using gist (seat_id with =, reserved_during with &&) where (active)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  provider text not null default 'paymongo' check (provider = 'paymongo'),
  method public.payment_method not null,
  status public.payment_status not null default 'pending',
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'PHP' check (currency = 'PHP'),
  provider_payment_id text unique,
  provider_checkout_id text unique,
  paid_at timestamptz,
  refunded_at timestamptz,
  failure_code text,
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payment_webhook_events (
  id text primary key,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  processing_error text,
  received_at timestamptz not null default now()
);

create table public.qr_access_passes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.check_in_sessions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete restrict,
  qr_access_pass_id uuid not null references public.qr_access_passes (id) on delete restrict,
  status public.check_in_status not null default 'checked_in',
  checked_in_at timestamptz not null default now(),
  checked_out_at timestamptz,
  scheduled_end_at timestamptz not null,
  overtime_minutes integer not null default 0 check (overtime_minutes >= 0),
  overtime_charge_cents bigint not null default 0 check (overtime_charge_cents >= 0),
  verified_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint check_in_checkout_order check (checked_out_at is null or checked_out_at >= checked_in_at)
);

create table public.hub_content (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 160),
  body jsonb not null default '{}'::jsonb,
  status public.content_status not null default 'draft',
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  body text not null check (char_length(body) between 1 and 5000),
  status public.content_status not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_valid_window check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table public.flashcard_decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text check (char_length(description) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.flashcard_decks (id) on delete cascade,
  front text not null check (char_length(front) between 1 and 5000),
  back text not null check (char_length(back) between 1 and 5000),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.flashcard_reviews (
  id bigint generated always as identity primary key,
  card_id uuid not null references public.flashcards (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  rating public.flashcard_rating not null,
  reviewed_at timestamptz not null default now()
);

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  planned_minutes integer not null check (planned_minutes between 1 and 1440),
  completed_minutes integer check (completed_minutes between 0 and 1440),
  completed boolean not null default false,
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_sessions_valid_window check (ended_at is null or ended_at >= started_at)
);

create table public.analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id) on delete set null,
  event_name text not null check (event_name ~ '^[a-z0-9_]{1,80}$'),
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (char_length(action) between 1 and 120),
  entity_type text not null check (char_length(entity_type) between 1 and 80),
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index bookings_user_id_created_at_idx on public.bookings (user_id, created_at desc);
create index bookings_schedule_idx on public.bookings (starts_at, ends_at);
create index bookings_status_starts_at_idx on public.bookings (status, starts_at);
create index bookings_pending_holds_idx on public.bookings (hold_expires_at) where status = 'pending';
create index booking_seats_seat_id_idx on public.booking_seats (seat_id);
create index payments_booking_id_created_at_idx on public.payments (booking_id, created_at desc);
create index payments_status_created_at_idx on public.payments (status, created_at desc);
create index check_in_sessions_qr_access_pass_id_idx on public.check_in_sessions (qr_access_pass_id);
create index check_in_sessions_verified_by_idx on public.check_in_sessions (verified_by);
create index check_in_sessions_status_checked_in_at_idx on public.check_in_sessions (status, checked_in_at desc);
create index hub_content_created_by_idx on public.hub_content (created_by);
create index hub_content_updated_by_idx on public.hub_content (updated_by);
create index announcements_created_by_idx on public.announcements (created_by);
create index announcements_publication_idx on public.announcements (status, starts_at, ends_at);
create index flashcard_decks_user_id_idx on public.flashcard_decks (user_id);
create index flashcards_deck_id_position_idx on public.flashcards (deck_id, position);
create index flashcard_reviews_card_id_idx on public.flashcard_reviews (card_id);
create index flashcard_reviews_user_id_reviewed_at_idx on public.flashcard_reviews (user_id, reviewed_at desc);
create index study_sessions_user_id_started_at_idx on public.study_sessions (user_id, started_at desc);
create index analytics_events_user_id_idx on public.analytics_events (user_id);
create index analytics_events_name_occurred_at_idx on public.analytics_events (event_name, occurred_at desc);
create index audit_logs_actor_id_idx on public.audit_logs (actor_id);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);

create function private.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function private.set_updated_at();
create trigger seats_set_updated_at before update on public.seats for each row execute function private.set_updated_at();
create trigger bookings_set_updated_at before update on public.bookings for each row execute function private.set_updated_at();
create trigger payments_set_updated_at before update on public.payments for each row execute function private.set_updated_at();
create trigger check_in_sessions_set_updated_at before update on public.check_in_sessions for each row execute function private.set_updated_at();
create trigger hub_content_set_updated_at before update on public.hub_content for each row execute function private.set_updated_at();
create trigger announcements_set_updated_at before update on public.announcements for each row execute function private.set_updated_at();
create trigger flashcard_decks_set_updated_at before update on public.flashcard_decks for each row execute function private.set_updated_at();
create trigger flashcards_set_updated_at before update on public.flashcards for each row execute function private.set_updated_at();
create trigger study_sessions_set_updated_at before update on public.study_sessions for each row execute function private.set_updated_at();

create function private.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    nullif(left(coalesce(new.raw_user_meta_data ->> 'phone', ''), 32), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function private.handle_new_user();

create function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('staff', 'admin') and is_active
  ), false);
$$;

create function private.generate_reservation_code() returns text language sql volatile set search_path = '' as $$
  select 'JIT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
$$;

create function private.sync_booking_seat_activity() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    update public.booking_seats
    set active = new.status in ('pending', 'confirmed', 'checked_in')
    where booking_id = new.id;
  end if;
  return new;
end;
$$;

create trigger bookings_sync_seat_activity after update of status on public.bookings
for each row execute function private.sync_booking_seat_activity();

create function private.create_booking(
  p_guest_name text, p_guest_email text, p_booking_date date, p_start_time time,
  p_duration_hours smallint, p_space text, p_seat_codes text[]
) returns public.bookings language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := (select auth.uid());
  v_booking public.bookings;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_code text;
  v_seat_count integer;
  v_subtotal bigint;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = v_user_id and is_active) then
    raise exception 'Active profile required' using errcode = '42501';
  end if;
  if p_guest_name is null or char_length(btrim(p_guest_name)) not between 1 and 120 then
    raise exception 'Invalid guest name' using errcode = '22023';
  end if;
  if p_guest_email is null or p_guest_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Invalid guest email' using errcode = '22023';
  end if;
  if p_duration_hours not between 1 and 24 then
    raise exception 'Duration must be between 1 and 24 hours' using errcode = '22023';
  end if;
  if cardinality(p_seat_codes) not between 1 and 5
     or cardinality(p_seat_codes) <> (select count(distinct value) from unnest(p_seat_codes) as value) then
    raise exception 'Choose between 1 and 5 unique seats' using errcode = '22023';
  end if;

  v_starts_at := (p_booking_date::timestamp + p_start_time) at time zone 'Asia/Manila';
  v_ends_at := v_starts_at + make_interval(hours => p_duration_hours);
  if v_starts_at <= now() then raise exception 'Reservation must start in the future' using errcode = '22023'; end if;

  for v_code in select value from unnest(p_seat_codes) as value order by value loop
    perform pg_advisory_xact_lock(hashtextextended('jit-seat:' || v_code, 0));
  end loop;

  update public.bookings
  set status = 'cancelled', cancelled_at = now(), cancellation_reason = 'Payment hold expired'
  where status = 'pending' and hold_expires_at <= now();

  select count(*), coalesce(sum(hourly_rate_cents * p_duration_hours), 0)
  into v_seat_count, v_subtotal
  from public.seats
  where code = any(p_seat_codes) and is_active and status <> 'maintenance';
  if v_seat_count <> cardinality(p_seat_codes) then
    raise exception 'One or more seats are unavailable' using errcode = 'P0001';
  end if;

  insert into public.bookings (
    reservation_code, user_id, guest_name, guest_email, booking_date, start_time,
    starts_at, ends_at, duration_hours, space, seat_ids, subtotal_cents, hold_expires_at
  ) values (
    private.generate_reservation_code(), v_user_id, btrim(p_guest_name), lower(p_guest_email),
    p_booking_date, p_start_time, v_starts_at, v_ends_at, p_duration_hours,
    coalesce(nullif(btrim(p_space), ''), 'study-seat'), p_seat_codes,
    v_subtotal, now() + interval '15 minutes'
  ) returning * into v_booking;

  begin
    insert into public.booking_seats (booking_id, seat_id, reserved_during)
    select v_booking.id, id, tstzrange(v_starts_at, v_ends_at, '[)')
    from public.seats where code = any(p_seat_codes);
  exception when exclusion_violation then
    raise exception 'One or more seats were just reserved for that time' using errcode = '23P01';
  end;
  return v_booking;
end;
$$;

create function public.create_booking(
  p_guest_name text, p_guest_email text, p_booking_date date, p_start_time time,
  p_duration_hours smallint, p_space text, p_seat_codes text[]
) returns public.bookings language sql security invoker set search_path = '' as $$
  select private.create_booking(p_guest_name, p_guest_email, p_booking_date, p_start_time,
    p_duration_hours, p_space, p_seat_codes);
$$;

create function private.cancel_booking(p_booking_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  update public.bookings
  set status = 'cancelled', cancelled_at = now(), cancellation_reason = 'Cancelled by customer'
  where id = p_booking_id and user_id = (select auth.uid())
    and status in ('pending', 'confirmed') and starts_at > now();
  if not found then raise exception 'Booking cannot be cancelled' using errcode = 'P0001'; end if;
end;
$$;

create function public.cancel_booking(p_booking_id uuid) returns void language sql security invoker set search_path = '' as $$
  select private.cancel_booking(p_booking_id);
$$;

create function private.get_available_seats(p_starts_at timestamptz, p_ends_at timestamptz)
returns setof public.seats language sql stable security definer set search_path = '' as $$
  select s.* from public.seats as s
  where s.is_active and s.status <> 'maintenance' and p_ends_at > p_starts_at
    and not exists (
      select 1 from public.booking_seats as bs
      where bs.seat_id = s.id and bs.active
        and bs.reserved_during && tstzrange(p_starts_at, p_ends_at, '[)')
    )
  order by s.code;
$$;

create function public.get_available_seats(p_starts_at timestamptz, p_ends_at timestamptz)
returns setof public.seats language sql stable security invoker set search_path = '' as $$
  select * from private.get_available_seats(p_starts_at, p_ends_at);
$$;

alter table public.profiles enable row level security;
alter table public.seats enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_seats enable row level security;
alter table public.payments enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.qr_access_passes enable row level security;
alter table public.check_in_sessions enable row level security;
alter table public.hub_content enable row level security;
alter table public.announcements enable row level security;
alter table public.flashcard_decks enable row level security;
alter table public.flashcards enable row level security;
alter table public.flashcard_reviews enable row level security;
alter table public.study_sessions enable row level security;
alter table public.analytics_events enable row level security;
alter table public.audit_logs enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated, service_role;
grant usage on schema private to anon, authenticated;

grant select on public.seats, public.hub_content, public.announcements to anon;
grant select on public.profiles, public.seats, public.bookings, public.booking_seats,
  public.payments, public.qr_access_passes, public.check_in_sessions, public.hub_content,
  public.announcements, public.flashcard_decks, public.flashcards, public.flashcard_reviews,
  public.study_sessions, public.analytics_events, public.audit_logs to authenticated;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;
grant insert, update, delete on public.seats, public.hub_content, public.announcements to authenticated;
grant update on public.bookings to authenticated;
grant insert, update on public.payments, public.qr_access_passes, public.check_in_sessions to authenticated;
grant insert, update, delete on public.flashcard_decks, public.flashcards to authenticated;
grant insert on public.flashcard_reviews to authenticated;
grant insert, update, delete on public.study_sessions to authenticated;
grant insert on public.analytics_events to anon, authenticated;
grant usage, select on sequence public.flashcard_reviews_id_seq to authenticated;
grant usage, select on sequence public.analytics_events_id_seq to anon, authenticated;

grant execute on function private.is_admin() to authenticated;
grant execute on function private.create_booking(text, text, date, time, smallint, text, text[]) to authenticated;
grant execute on function private.cancel_booking(uuid) to authenticated;
grant execute on function private.get_available_seats(timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.create_booking(text, text, date, time, smallint, text, text[]) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
grant execute on function public.get_available_seats(timestamptz, timestamptz) to anon, authenticated;

create policy "Users read own profile; staff read all" on public.profiles for select to authenticated
using ((select auth.uid()) = id or (select private.is_admin()));
create policy "Users update own profile" on public.profiles for update to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "Visitors read active seats" on public.seats for select to anon
using (is_active);
create policy "Users read active seats; staff read all" on public.seats for select to authenticated
using (is_active or (select private.is_admin()));
create policy "Staff insert seats" on public.seats for insert to authenticated
with check ((select private.is_admin()));
create policy "Staff update seats" on public.seats for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Staff delete seats" on public.seats for delete to authenticated
using ((select private.is_admin()));
create policy "Users read own bookings; staff read all" on public.bookings for select to authenticated
using ((select auth.uid()) = user_id or (select private.is_admin()));
create policy "Staff update bookings" on public.bookings for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "Users read own booking seats; staff read all" on public.booking_seats for select to authenticated using (
  exists (select 1 from public.bookings where bookings.id = booking_seats.booking_id
    and (bookings.user_id = (select auth.uid()) or (select private.is_admin())))
);
create policy "Users read own payments; staff read all" on public.payments for select to authenticated using (
  exists (select 1 from public.bookings where bookings.id = payments.booking_id
    and (bookings.user_id = (select auth.uid()) or (select private.is_admin())))
);
create policy "Staff insert payments" on public.payments for insert to authenticated
with check ((select private.is_admin()));
create policy "Staff update payments" on public.payments for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Staff delete payments" on public.payments for delete to authenticated
using ((select private.is_admin()));
create policy "Users read own QR pass metadata; staff read all" on public.qr_access_passes for select to authenticated using (
  exists (select 1 from public.bookings where bookings.id = qr_access_passes.booking_id
    and (bookings.user_id = (select auth.uid()) or (select private.is_admin())))
);
create policy "Staff insert QR passes" on public.qr_access_passes for insert to authenticated
with check ((select private.is_admin()));
create policy "Staff update QR passes" on public.qr_access_passes for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Staff delete QR passes" on public.qr_access_passes for delete to authenticated
using ((select private.is_admin()));
create policy "Users read own check-ins; staff read all" on public.check_in_sessions for select to authenticated using (
  exists (select 1 from public.bookings where bookings.id = check_in_sessions.booking_id
    and (bookings.user_id = (select auth.uid()) or (select private.is_admin())))
);
create policy "Staff insert check-ins" on public.check_in_sessions for insert to authenticated
with check ((select private.is_admin()));
create policy "Staff update check-ins" on public.check_in_sessions for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Staff delete check-ins" on public.check_in_sessions for delete to authenticated
using ((select private.is_admin()));

create policy "Visitors read published content" on public.hub_content for select to anon
using (status = 'published');
create policy "Users read published content; staff read all" on public.hub_content for select to authenticated
using (status = 'published' or (select private.is_admin()));
create policy "Staff insert content" on public.hub_content for insert to authenticated
with check ((select private.is_admin()));
create policy "Staff update content" on public.hub_content for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Staff delete content" on public.hub_content for delete to authenticated
using ((select private.is_admin()));
create policy "Visitors read current announcements" on public.announcements for select to anon using (
  status = 'published' and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())
);
create policy "Users read current announcements; staff read all" on public.announcements for select to authenticated using (
  (status = 'published' and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()))
  or (select private.is_admin())
);
create policy "Staff insert announcements" on public.announcements for insert to authenticated
with check ((select private.is_admin()));
create policy "Staff update announcements" on public.announcements for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Staff delete announcements" on public.announcements for delete to authenticated
using ((select private.is_admin()));

create policy "Users manage own decks" on public.flashcard_decks for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage cards in own decks" on public.flashcards for all to authenticated using (
  exists (select 1 from public.flashcard_decks where flashcard_decks.id = flashcards.deck_id
    and flashcard_decks.user_id = (select auth.uid()))
) with check (
  exists (select 1 from public.flashcard_decks where flashcard_decks.id = flashcards.deck_id
    and flashcard_decks.user_id = (select auth.uid()))
);
create policy "Users read own reviews" on public.flashcard_reviews for select to authenticated
using ((select auth.uid()) = user_id);
create policy "Users create own reviews" on public.flashcard_reviews for insert to authenticated with check (
  (select auth.uid()) = user_id and exists (
    select 1 from public.flashcards join public.flashcard_decks on flashcard_decks.id = flashcards.deck_id
    where flashcards.id = flashcard_reviews.card_id and flashcard_decks.user_id = (select auth.uid())
  )
);
create policy "Users manage own study sessions" on public.study_sessions for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Visitors submit anonymous analytics" on public.analytics_events for insert to anon
with check (user_id is null);
create policy "Users submit own analytics" on public.analytics_events for insert to authenticated
with check (user_id is null or user_id = (select auth.uid()));
create policy "Staff read analytics" on public.analytics_events for select to authenticated
using ((select private.is_admin()));
create policy "Staff read audit logs" on public.audit_logs for select to authenticated
using ((select private.is_admin()));

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

insert into public.seats (code, name, zone, seat_type, hourly_rate_cents)
select code, 'Seat ' || code, zone, seat_type, 5000
from (values
  ('LA01','Left Area','individual'), ('LA02','Left Area','individual'), ('LA03','Left Area','individual'), ('LA04','Left Area','individual'),
  ('LA05','Left Area','individual'), ('LA06','Left Area','individual'), ('LA07','Left Area','individual'), ('LA08','Left Area','individual'),
  ('LB01','Left Booth','booth'), ('LB02','Left Booth','booth'), ('LB03','Left Booth','booth'), ('LB04','Left Booth','booth'),
  ('UA01','Upper Area','individual'), ('UA02','Upper Area','individual'), ('UA03','Upper Area','individual'), ('UA04','Upper Area','individual'),
  ('UA05','Upper Area','individual'), ('UA06','Upper Area','individual'), ('UA07','Upper Area','individual'), ('UA08','Upper Area','individual'),
  ('UB01','Upper Booth','booth'), ('UB02','Upper Booth','booth'),
  ('LW01','Left Window','window'), ('LW02','Left Window','window'), ('LW03','Left Window','window'), ('LW04','Left Window','window'),
  ('RA01','Right Area','individual'), ('RA02','Right Area','individual'), ('RA03','Right Area','individual'), ('RA04','Right Area','individual'),
  ('RB01','Right Booth','booth'), ('RB02','Right Booth','booth'), ('RB03','Right Booth','booth'), ('RB04','Right Booth','booth'),
  ('RC01','Right Corner','individual'), ('RC02','Right Corner','individual'), ('RC03','Right Corner','individual'), ('RC04','Right Corner','individual'),
  ('RW01','Right Window','window'), ('RW02','Right Window','window'), ('RW03','Right Window','window'), ('RW04','Right Window','window'),
  ('BR01','Break Room','lounge'), ('BR02','Break Room','lounge'), ('BR03','Break Room','lounge'), ('BR04','Break Room','lounge'),
  ('BR05','Break Room','lounge'), ('BR06','Break Room','lounge'), ('BR07','Break Room','lounge'), ('BR08','Break Room','lounge')
) as seed(code, zone, seat_type);

comment on table public.profiles is 'Application profile linked one-to-one with Supabase Auth.';
comment on table public.payment_webhook_events is 'Server-only idempotency log for verified PayMongo webhooks.';
comment on column public.qr_access_passes.token_hash is 'Store only a one-way hash; never persist the raw QR token.';
