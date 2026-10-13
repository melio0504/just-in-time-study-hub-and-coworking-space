-- Development-only sample content. Facility seats are reference data and are
-- inserted by the migration so they exist in both local and production.

-- Local development administrator. Never apply this seed file to production.
-- This block is intentionally idempotent so running it again restores the
-- documented local credentials instead of creating a duplicate Auth user.
do $$
declare
  v_admin_id uuid;
  v_admin_email constant text := 'admin@jit-studyhub.com';
  v_admin_password constant text := 'admin123';
begin
  select id
  into v_admin_id
  from auth.users
  where lower(email) = v_admin_email
    and not is_sso_user
  limit 1;

  if v_admin_id is null then
    v_admin_id := '7d3b185a-905f-4f7a-93ec-a9e5276cdfe2'::uuid;

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      email_change_token_current,
      reauthentication_token,
      is_sso_user,
      is_anonymous
    ) values (
      '00000000-0000-0000-0000-000000000000'::uuid,
      v_admin_id,
      'authenticated',
      'authenticated',
      v_admin_email,
      extensions.crypt(v_admin_password, extensions.gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object(
        'sub', v_admin_id::text,
        'email', v_admin_email,
        'full_name', 'JIT Administrator',
        'email_verified', true,
        'phone_verified', false
      ),
      false,
      now(),
      now(),
      '',
      '',
      '',
      '',
      '',
      '',
      false,
      false
    );
  else
    update auth.users
    set encrypted_password = extensions.crypt(v_admin_password, extensions.gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        email_change = '',
        raw_app_meta_data = jsonb_build_object(
          'provider', 'email',
          'providers', jsonb_build_array('email')
        ),
        raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
          'sub', v_admin_id::text,
          'email', v_admin_email,
          'full_name', 'JIT Administrator',
          'email_verified', true,
          'phone_verified', false
        ),
        updated_at = now()
    where id = v_admin_id;
  end if;

  insert into auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    v_admin_id::text,
    v_admin_id,
    jsonb_build_object(
      'sub', v_admin_id::text,
      'email', v_admin_email,
      'full_name', 'JIT Administrator',
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  )
  on conflict (provider_id, provider) do update
  set user_id = excluded.user_id,
      identity_data = excluded.identity_data,
      updated_at = now();

  update public.profiles
  set full_name = 'JIT Administrator',
      email = v_admin_email,
      role = 'admin',
      is_active = true,
      must_change_password = false,
      staff_permissions = '{}'::public.staff_permission[]
  where id = v_admin_id;
end
$$;

-- Ready-to-use local employee accounts. Their permissions intentionally vary
-- so the owner can preview each scoped dashboard experience. Every employee
-- uses the local-only password `employee123`.
do $$
declare
  v_employee record;
  v_password constant text := 'employee123';
begin
  for v_employee in
    select * from (values
      (
        'f1000000-0000-4000-8000-000000000001'::uuid,
        'Andrea Lim',
        'andrea.lim@example.test',
        '+639180000001',
        array['seating', 'reservations']::public.staff_permission[]
      ),
      (
        'f1000000-0000-4000-8000-000000000002'::uuid,
        'Ramon de Leon',
        'ramon.deleon@example.test',
        '+639180000002',
        array['seating']::public.staff_permission[]
      ),
      (
        'f1000000-0000-4000-8000-000000000003'::uuid,
        'Sofia Mercado',
        'sofia.mercado@example.test',
        '+639180000003',
        array['announcements']::public.staff_permission[]
      )
    ) as employee_seed(id, full_name, email, phone, permissions)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, created_at, updated_at, confirmation_token,
      recovery_token, email_change_token_new, email_change,
      email_change_token_current, reauthentication_token,
      is_sso_user, is_anonymous
    ) values (
      '00000000-0000-0000-0000-000000000000'::uuid,
      v_employee.id,
      'authenticated',
      'authenticated',
      v_employee.email,
      extensions.crypt(v_password, extensions.gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object(
        'sub', v_employee.id::text,
        'email', v_employee.email,
        'full_name', v_employee.full_name,
        'phone', v_employee.phone,
        'email_verified', true,
        'phone_verified', false
      ),
      false, now(), now(), '', '', '', '', '', '', false, false
    )
    on conflict (id) do update
    set email = excluded.email,
        encrypted_password = excluded.encrypted_password,
        email_confirmed_at = coalesce(auth.users.email_confirmed_at, excluded.email_confirmed_at),
        raw_app_meta_data = excluded.raw_app_meta_data,
        raw_user_meta_data = excluded.raw_user_meta_data,
        updated_at = now();

    insert into auth.identities (
      provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      v_employee.id::text,
      v_employee.id,
      jsonb_build_object(
        'sub', v_employee.id::text,
        'email', v_employee.email,
        'full_name', v_employee.full_name,
        'email_verified', true,
        'phone_verified', false
      ),
      'email', now(), now(), now()
    )
    on conflict (provider_id, provider) do update
    set user_id = excluded.user_id,
        identity_data = excluded.identity_data,
        updated_at = now();

    update public.profiles
    set full_name = v_employee.full_name,
        phone = v_employee.phone,
        email = v_employee.email,
        role = 'staff',
        staff_permissions = v_employee.permissions,
        must_change_password = false,
        is_active = true
    where id = v_employee.id;
  end loop;
end
$$;

-- Local customer accounts used by the reservation, kiosk, and admin demos.
-- The addresses use the reserved .test domain, so the seed can never email a
-- real person. Every account has the local-only password `customer123`.
do $$
declare
  v_customer record;
  v_password constant text := 'customer123';
begin
  for v_customer in
    select * from (values
      ('b1000000-0000-4000-8000-000000000001'::uuid, 'Maria Santos',      'maria.santos@example.test',      '+639170000001'),
      ('b1000000-0000-4000-8000-000000000002'::uuid, 'Juan Dela Cruz',    'juan.delacruz@example.test',     '+639170000002'),
      ('b1000000-0000-4000-8000-000000000003'::uuid, 'Angela Reyes',      'angela.reyes@example.test',      '+639170000003'),
      ('b1000000-0000-4000-8000-000000000004'::uuid, 'Carlo Mendoza',     'carlo.mendoza@example.test',     '+639170000004'),
      ('b1000000-0000-4000-8000-000000000005'::uuid, 'Bianca Villanueva', 'bianca.villanueva@example.test', '+639170000005'),
      ('b1000000-0000-4000-8000-000000000006'::uuid, 'Miguel Bautista',   'miguel.bautista@example.test',   '+639170000006'),
      ('b1000000-0000-4000-8000-000000000007'::uuid, 'Patricia Garcia',   'patricia.garcia@example.test',   '+639170000007'),
      ('b1000000-0000-4000-8000-000000000008'::uuid, 'Joshua Ramos',      'joshua.ramos@example.test',      '+639170000008'),
      ('b1000000-0000-4000-8000-000000000009'::uuid, 'Nicole Flores',     'nicole.flores@example.test',     '+639170000009'),
      ('b1000000-0000-4000-8000-000000000010'::uuid, 'Paolo Navarro',     'paolo.navarro@example.test',     '+639170000010'),
      ('b1000000-0000-4000-8000-000000000011'::uuid, 'Camille Aquino',    'camille.aquino@example.test',    '+639170000011'),
      ('b1000000-0000-4000-8000-000000000012'::uuid, 'Adrian Castillo',   'adrian.castillo@example.test',   '+639170000012')
    ) as customer_seed(id, full_name, email, phone)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, created_at, updated_at, confirmation_token,
      recovery_token, email_change_token_new, email_change,
      email_change_token_current, reauthentication_token,
      is_sso_user, is_anonymous
    ) values (
      '00000000-0000-0000-0000-000000000000'::uuid,
      v_customer.id,
      'authenticated',
      'authenticated',
      v_customer.email,
      extensions.crypt(v_password, extensions.gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object(
        'sub', v_customer.id::text,
        'email', v_customer.email,
        'full_name', v_customer.full_name,
        'phone', v_customer.phone,
        'email_verified', true,
        'phone_verified', false
      ),
      false, now(), now(), '', '', '', '', '', '', false, false
    )
    on conflict (id) do update
    set email = excluded.email,
        encrypted_password = excluded.encrypted_password,
        email_confirmed_at = coalesce(auth.users.email_confirmed_at, excluded.email_confirmed_at),
        raw_app_meta_data = excluded.raw_app_meta_data,
        raw_user_meta_data = excluded.raw_user_meta_data,
        updated_at = now();

    insert into auth.identities (
      provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      v_customer.id::text,
      v_customer.id,
      jsonb_build_object(
        'sub', v_customer.id::text,
        'email', v_customer.email,
        'full_name', v_customer.full_name,
        'email_verified', true,
        'phone_verified', false
      ),
      'email', now(), now(), now()
    )
    on conflict (provider_id, provider) do update
    set user_id = excluded.user_id,
        identity_data = excluded.identity_data,
        updated_at = now();

    update public.profiles
    set full_name = v_customer.full_name,
        phone = v_customer.phone,
        email = v_customer.email,
        role = 'customer',
        is_active = true
    where id = v_customer.id;
  end loop;
end
$$;

-- Operational demo data is anchored to the reset time. The first three
-- reservations are always currently checked in; the others cover common
-- time slots today and tomorrow so /reserve visibly has unavailable seats.
with clock as (
  select (now() at time zone 'Asia/Manila')::date as manila_today
), booking_seed as (
  select * from (values
    ('a1000000-0000-4000-8000-000000000001'::uuid, 'JIT-DEMO-001', 'b1000000-0000-4000-8000-000000000001'::uuid, 'Maria Santos',      'maria.santos@example.test',      now() - interval '30 minutes', 4::smallint, array['SO01','SO02']::text[], 'checked_in'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000002'::uuid, 'JIT-DEMO-002', 'b1000000-0000-4000-8000-000000000002'::uuid, 'Juan Dela Cruz',    'juan.delacruz@example.test',     now() - interval '75 minutes', 5::smallint, array['FD09']::text[],        'checked_in'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000003'::uuid, 'JIT-DEMO-003', 'b1000000-0000-4000-8000-000000000003'::uuid, 'Angela Reyes',      'angela.reyes@example.test',      now() - interval '15 minutes', 3::smallint, array['HC13','HC14','HC15']::text[], 'checked_in'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000004'::uuid, 'JIT-DEMO-004', 'b1000000-0000-4000-8000-000000000004'::uuid, 'Carlo Mendoza',     'carlo.mendoza@example.test',     ((select manila_today from clock)::timestamp + interval '9 hours')  at time zone 'Asia/Manila', 3::smallint, array['SO03','SO04']::text[], 'confirmed'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000005'::uuid, 'JIT-DEMO-005', 'b1000000-0000-4000-8000-000000000005'::uuid, 'Bianca Villanueva', 'bianca.villanueva@example.test', ((select manila_today from clock)::timestamp + interval '13 hours') at time zone 'Asia/Manila', 4::smallint, array['FD01','FD02']::text[], 'confirmed'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000006'::uuid, 'JIT-DEMO-006', 'b1000000-0000-4000-8000-000000000006'::uuid, 'Miguel Bautista',   'miguel.bautista@example.test',   ((select manila_today from clock)::timestamp + interval '18 hours') at time zone 'Asia/Manila', 4::smallint, array['GS05']::text[],        'confirmed'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000007'::uuid, 'JIT-DEMO-007', 'b1000000-0000-4000-8000-000000000007'::uuid, 'Patricia Garcia',   'patricia.garcia@example.test',   ((select manila_today from clock)::timestamp + interval '22 hours') at time zone 'Asia/Manila', 4::smallint, array['HC01','HC02']::text[], 'confirmed'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000008'::uuid, 'JIT-DEMO-008', 'b1000000-0000-4000-8000-000000000008'::uuid, 'Joshua Ramos',      'joshua.ramos@example.test',      (((select manila_today from clock) + 1)::timestamp + interval '8 hours')  at time zone 'Asia/Manila', 4::smallint, array['SO05','SO06']::text[], 'confirmed'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000009'::uuid, 'JIT-DEMO-009', 'b1000000-0000-4000-8000-000000000009'::uuid, 'Nicole Flores',     'nicole.flores@example.test',     (((select manila_today from clock) + 1)::timestamp + interval '14 hours') at time zone 'Asia/Manila', 4::smallint, array['FD03','FD04','FD05']::text[], 'confirmed'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000010'::uuid, 'JIT-DEMO-010', 'b1000000-0000-4000-8000-000000000010'::uuid, 'Paolo Navarro',     'paolo.navarro@example.test',     (((select manila_today from clock) + 1)::timestamp + interval '20 hours') at time zone 'Asia/Manila', 4::smallint, array['GS09','GS10']::text[], 'confirmed'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000011'::uuid, 'JIT-DEMO-011', 'b1000000-0000-4000-8000-000000000011'::uuid, 'Camille Aquino',    'camille.aquino@example.test',    (((select manila_today from clock) - 1)::timestamp + interval '10 hours') at time zone 'Asia/Manila', 3::smallint, array['HC05']::text[],        'completed'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000012'::uuid, 'JIT-DEMO-012', 'b1000000-0000-4000-8000-000000000012'::uuid, 'Adrian Castillo',   'adrian.castillo@example.test',   (((select manila_today from clock) + 1)::timestamp + interval '11 hours') at time zone 'Asia/Manila', 2::smallint, array['SO07']::text[],        'cancelled'::public.booking_status)
  ) as seeded(id, reservation_code, user_id, guest_name, guest_email, starts_at, duration_hours, seat_ids, status)
)
insert into public.bookings (
  id, reservation_code, user_id, guest_name, guest_email, booking_date,
  start_time, starts_at, ends_at, duration_hours, space, seat_ids,
  status, payment_status, subtotal_cents, hold_expires_at, cancelled_at,
  cancellation_reason, confirmation_email_sent_at, created_at, updated_at
)
select
  id,
  reservation_code,
  user_id,
  guest_name,
  guest_email,
  (starts_at at time zone 'Asia/Manila')::date,
  (starts_at at time zone 'Asia/Manila')::time,
  starts_at,
  starts_at + make_interval(hours => duration_hours),
  duration_hours,
  'study-seat',
  seat_ids,
  status,
  'not_required'::public.payment_status,
  cardinality(seat_ids) * duration_hours * 5000,
  null,
  case when status = 'cancelled' then now() - interval '2 hours' end,
  case when status = 'cancelled' then 'Customer schedule changed' end,
  case when status in ('confirmed', 'checked_in', 'completed') then now() - interval '2 hours' end,
  least(starts_at - interval '2 days', now() - interval '3 hours'),
  now()
from booking_seed
on conflict (id) do update
set guest_name = excluded.guest_name,
    guest_email = excluded.guest_email,
    booking_date = excluded.booking_date,
    start_time = excluded.start_time,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    duration_hours = excluded.duration_hours,
    seat_ids = excluded.seat_ids,
    status = excluded.status,
    payment_status = excluded.payment_status,
    subtotal_cents = excluded.subtotal_cents,
    hold_expires_at = excluded.hold_expires_at,
    cancelled_at = excluded.cancelled_at,
    cancellation_reason = excluded.cancellation_reason,
    confirmation_email_sent_at = excluded.confirmation_email_sent_at,
    updated_at = now();

insert into public.booking_seats (booking_id, seat_id, reserved_during, active)
select
  booking.id,
  seat.id,
  tstzrange(booking.starts_at, booking.ends_at, '[)'),
  booking.status in ('pending', 'confirmed', 'checked_in')
from public.bookings booking
join public.seats seat on seat.code = any(booking.seat_ids)
where booking.id in (
  'a1000000-0000-4000-8000-000000000001'::uuid,
  'a1000000-0000-4000-8000-000000000002'::uuid,
  'a1000000-0000-4000-8000-000000000003'::uuid,
  'a1000000-0000-4000-8000-000000000004'::uuid,
  'a1000000-0000-4000-8000-000000000005'::uuid,
  'a1000000-0000-4000-8000-000000000006'::uuid,
  'a1000000-0000-4000-8000-000000000007'::uuid,
  'a1000000-0000-4000-8000-000000000008'::uuid,
  'a1000000-0000-4000-8000-000000000009'::uuid,
  'a1000000-0000-4000-8000-000000000010'::uuid,
  'a1000000-0000-4000-8000-000000000011'::uuid,
  'a1000000-0000-4000-8000-000000000012'::uuid
)
on conflict (booking_id, seat_id) do update
set reserved_during = excluded.reserved_during,
    active = excluded.active;

insert into public.qr_access_passes (id, booking_id, token_hash, expires_at)
select
  pass.id,
  pass.booking_id,
  encode(extensions.digest('jit-local-demo-pass:' || pass.booking_id::text, 'sha256'), 'hex'),
  booking.ends_at + interval '1 hour'
from (values
  ('c1000000-0000-4000-8000-000000000001'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid),
  ('c1000000-0000-4000-8000-000000000002'::uuid, 'a1000000-0000-4000-8000-000000000002'::uuid),
  ('c1000000-0000-4000-8000-000000000003'::uuid, 'a1000000-0000-4000-8000-000000000003'::uuid)
) as pass(id, booking_id)
join public.bookings booking on booking.id = pass.booking_id
on conflict (booking_id) do update
set expires_at = excluded.expires_at,
    revoked_at = null;

insert into public.check_in_sessions (
  id, booking_id, qr_access_pass_id, status, checked_in_at, scheduled_end_at
)
select
  session.id,
  session.booking_id,
  pass.id,
  'checked_in'::public.check_in_status,
  booking.starts_at + interval '5 minutes',
  booking.ends_at
from (values
  ('d1000000-0000-4000-8000-000000000001'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid),
  ('d1000000-0000-4000-8000-000000000002'::uuid, 'a1000000-0000-4000-8000-000000000002'::uuid),
  ('d1000000-0000-4000-8000-000000000003'::uuid, 'a1000000-0000-4000-8000-000000000003'::uuid)
) as session(id, booking_id)
join public.bookings booking on booking.id = session.booking_id
join public.qr_access_passes pass on pass.booking_id = session.booking_id
on conflict (booking_id) do update
set qr_access_pass_id = excluded.qr_access_pass_id,
    status = excluded.status,
    checked_in_at = excluded.checked_in_at,
    checked_out_at = null,
    scheduled_end_at = excluded.scheduled_end_at,
    overtime_minutes = 0,
    overtime_charge_cents = 0;

-- Two current walk-ins make the admin live floor plan less uniform. They use
-- seats that are not part of the seeded reservations above.
insert into public.walk_in_occupancies (
  id, seat_id, guest_name, started_at, created_by
)
select
  walk_in.id,
  seat.id,
  walk_in.guest_name,
  now() - walk_in.elapsed,
  '7d3b185a-905f-4f7a-93ec-a9e5276cdfe2'::uuid
from (values
  ('e1000000-0000-4000-8000-000000000001'::uuid, 'HC11', 'Liza Manalo', interval '40 minutes'),
  ('e1000000-0000-4000-8000-000000000002'::uuid, 'HC12', 'Mark Evangelista', interval '20 minutes')
) as walk_in(id, seat_code, guest_name, elapsed)
join public.seats seat on seat.code = walk_in.seat_code
on conflict (id) do update
set guest_name = excluded.guest_name,
    started_at = excluded.started_at,
    ended_at = null,
    ended_by = null;

insert into public.hub_content (slug, title, body, status, published_at)
values (
  'welcome',
  'Just In Time Study Hub and Coworking Space',
  '{"summary":"A focused, comfortable place to study and work."}'::jsonb,
  'published',
  now()
)
on conflict (slug) do nothing;

insert into public.announcements (title, body, status, starts_at)
select seed.title, seed.body, seed.status::public.content_status, seed.starts_at
from (values
  (
    'October focus-week schedule',
    'The hub will stay open until 2:00 AM from Monday through Saturday this week. Quiet-zone rules remain in effect after 10:00 PM.',
    'published'::text,
    (current_date - 1)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'Extended study hours this exam season',
    'We are extending our operating hours during exam season so you have more time to focus, review, and finish your requirements.',
    'published'::text,
    (current_date - 2)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'New quiet-zone seating available',
    'Additional seats in the quiet zone are now available for individual study sessions. Reserve early for peak afternoon hours.',
    'published'::text,
    (current_date - 12)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'Free coffee refill weekend',
    'Guests with an active day pass can enjoy unlimited brewed coffee refills this Saturday and Sunday while supplies last.',
    'published'::text,
    (current_date - 18)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'Improved Wi-Fi coverage now live',
    'We completed our access-point upgrade. The quiet zone and back-row seats now have stronger and more consistent Wi-Fi coverage.',
    'published'::text,
    (current_date - 27)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'Printing station service update',
    'The self-service printing station is available again. Please ask the front desk for current black-and-white and color printing rates.',
    'published'::text,
    (current_date - 39)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'Holiday operating hours',
    'The hub will operate from 10:00 AM to 10:00 PM on the upcoming public holiday. Online reservations remain available.',
    'published'::text,
    (current_date - 52)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'Study room etiquette reminder',
    'Please keep calls brief, use headphones, and leave shared desks clean for the next guest. Thank you for helping everyone stay focused.',
    'published'::text,
    (current_date - 65)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'Updated day-pass inclusions',
    'Day passes now include access to charging adapters, drinking water, and the pantry throughout the reserved session.',
    'published'::text,
    (current_date - 78)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'Weekend maintenance notice',
    'A short network maintenance window is planned this weekend. This draft can be edited and published by the admin team.',
    'draft'::text,
    (current_date + 5)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'Student organization partnership',
    'A partnership announcement is being reviewed with participating student organizations before publication.',
    'draft'::text,
    (current_date + 12)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'Old air-conditioning advisory',
    'Preventive air-conditioning maintenance was completed and normal operating temperatures have resumed.',
    'archived'::text,
    (current_date - 95)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'Previous network maintenance notice',
    'The scheduled internet maintenance was completed successfully with no remaining service interruptions.',
    'archived'::text,
    (current_date - 120)::timestamp at time zone 'Asia/Manila'
  )
) as seed(title, body, status, starts_at)
where not exists (
  select 1 from public.announcements existing where existing.title = seed.title
);

-- Reproducible sample business history for the analytics dashboard. These rows
-- are database data (not UI constants) and can later be replaced by a nightly
-- aggregation job as real operations accumulate.
insert into public.daily_business_metrics (
  metric_date,
  revenue_cents,
  bookings_count,
  checkins_count,
  occupied_seat_hours,
  available_seat_hours,
  active_members,
  hourly_revenue_cents,
  daily_pass_revenue_cents,
  monthly_revenue_cents
)
select
  day::date,
  (
    260000
    + ((extract(doy from day)::integer * 3571) % 120000)
    + ((extract(doy from day)::integer * 2371) % 90000)
    + ((extract(doy from day)::integer * 1973) % 100000)
  )::bigint,
  9 + ((extract(doy from day)::integer * 7) % 19),
  7 + ((extract(doy from day)::integer * 5) % 17),
  70 + ((extract(doy from day)::integer * 13) % 260),
  600,
  96 + ((extract(doy from day)::integer * 3) % 75),
  (100000 + ((extract(doy from day)::integer * 3571) % 120000))::bigint,
  (70000 + ((extract(doy from day)::integer * 2371) % 90000))::bigint,
  (90000 + ((extract(doy from day)::integer * 1973) % 100000))::bigint
from generate_series(current_date - 179, current_date, interval '1 day') as day
on conflict (metric_date) do update set
  revenue_cents = excluded.revenue_cents,
  bookings_count = excluded.bookings_count,
  checkins_count = excluded.checkins_count,
  occupied_seat_hours = excluded.occupied_seat_hours,
  available_seat_hours = excluded.available_seat_hours,
  active_members = excluded.active_members,
  hourly_revenue_cents = excluded.hourly_revenue_cents,
  daily_pass_revenue_cents = excluded.daily_pass_revenue_cents,
  monthly_revenue_cents = excluded.monthly_revenue_cents;
