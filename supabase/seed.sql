-- Development-only sample content. Facility seats are reference data and are
-- inserted by the migration so they exist in both local and production.

-- Some sample reservations are intentionally historical. This session-only
-- flag lets the seed restore those fixtures without weakening application calls.
select set_config('jit.seed_mode', 'on', false);

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
    -- Match production sign-ups: Auth assigns a fresh UUID instead of a
    -- recognizable seed sequence. Email remains the stable idempotency key.
    v_admin_id := gen_random_uuid();

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
        'full_name', 'Admin',
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
          'full_name', 'Admin',
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
      'full_name', 'Admin',
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
  set full_name = 'Admin',
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
  v_employee_id uuid;
  v_password constant text := 'employee123';
begin
  for v_employee in
    select * from (values
      (
        'Andrea Lim',
        'andrea.lim@jit-studyhub.com',
        '+639180000001',
        array['seating', 'reservations']::public.staff_permission[]
      ),
      (
        'Ramon de Leon',
        'ramon.deleon@jit-studyhub.com',
        '+639180000002',
        array['seating']::public.staff_permission[]
      ),
      (
        'Sofia Mercado',
        'sofia.mercado@jit-studyhub.com',
        '+639180000003',
        array['announcements']::public.staff_permission[]
      ),
      (
        'Jerome Valdez',
        'jerome.valdez@jit-studyhub.com',
        '+639180000004',
        array['seating', 'reservations', 'announcements']::public.staff_permission[]
      ),
      (
        'Mikaela Soriano',
        'mikaela.soriano@jit-studyhub.com',
        '+639180000005',
        array['seating', 'reservations']::public.staff_permission[]
      )
    ) as employee_seed(full_name, email, phone, permissions)
  loop
    select id into v_employee_id
    from auth.users
    where lower(email) = lower(v_employee.email)
      and not is_sso_user
    limit 1;

    if v_employee_id is null then
      v_employee_id := gen_random_uuid();

      insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, created_at, updated_at, confirmation_token,
      recovery_token, email_change_token_new, email_change,
      email_change_token_current, reauthentication_token,
      is_sso_user, is_anonymous
    ) values (
      '00000000-0000-0000-0000-000000000000'::uuid,
      v_employee_id,
      'authenticated',
      'authenticated',
      v_employee.email,
      extensions.crypt(v_password, extensions.gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object(
        'sub', v_employee_id::text,
        'email', v_employee.email,
        'full_name', v_employee.full_name,
        'phone', v_employee.phone,
        'email_verified', true,
        'phone_verified', false
      ),
      false, now(), now(), '', '', '', '', '', '', false, false
      );
    else
      update auth.users
      set email = v_employee.email,
        encrypted_password = extensions.crypt(v_password, extensions.gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
        raw_user_meta_data = jsonb_build_object(
          'sub', v_employee_id::text,
          'email', v_employee.email,
          'full_name', v_employee.full_name,
          'phone', v_employee.phone,
          'email_verified', true,
          'phone_verified', false
        ),
        updated_at = now()
      where id = v_employee_id;
    end if;

    insert into auth.identities (
      provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      v_employee_id::text,
      v_employee_id,
      jsonb_build_object(
        'sub', v_employee_id::text,
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
    where id = v_employee_id;
  end loop;
end
$$;

-- Local customer accounts used by the reservation, kiosk, and admin demos.
-- Gmail-formatted addresses make the user list look like real sign-ups. This
-- file remains development-only and must never be applied to production.
-- Every account has the local-only password `customer123`.
do $$
declare
  v_customer record;
  v_customer_id uuid;
  v_password constant text := 'customer123';
begin
  for v_customer in
    with name_pool as (
      select
        array['Aaron','Beatrice','Cedric','Danica','Enzo','Faith','Gabriel','Isabelle','Joaquin','Katrina']::text[] as first_names,
        array['Alonzo','Bernardo','Corpuz','David','Estrella','Fernandez','Gonzales','Herrera','Ignacio','Jimenez']::text[] as last_names
    ), generated_customers as (
      select
        name_pool.first_names[((customer_number - 1) % 10) + 1]
          || ' ' || name_pool.last_names[((customer_number - 1) / 10) + 1] as full_name,
        lower(name_pool.first_names[((customer_number - 1) % 10) + 1])
          || '.' || lower(name_pool.last_names[((customer_number - 1) / 10) + 1])
          || '.jit' || lpad(customer_number::text, 3, '0') || '@gmail.com' as email,
        '+63919' || lpad(customer_number::text, 7, '0') as phone
      from generate_series(1, 100) as customer(customer_number)
      cross join name_pool
    )
    select * from (values
      ('Maria Santos',      'maria.santos.jit@gmail.com',       '+639170000001'),
      ('Juan Dela Cruz',    'juan.delacruz.jit@gmail.com',      '+639170000002'),
      ('Angela Reyes',      'angela.reyes.jit@gmail.com',       '+639170000003'),
      ('Carlo Mendoza',     'carlo.mendoza.jit@gmail.com',      '+639170000004'),
      ('Bianca Villanueva', 'bianca.villanueva.jit@gmail.com',  '+639170000005'),
      ('Miguel Bautista',   'miguel.bautista.jit@gmail.com',    '+639170000006'),
      ('Patricia Garcia',   'patricia.garcia.jit@gmail.com',    '+639170000007'),
      ('Joshua Ramos',      'joshua.ramos.jit@gmail.com',       '+639170000008'),
      ('Nicole Flores',     'nicole.flores.jit@gmail.com',      '+639170000009'),
      ('Paolo Navarro',     'paolo.navarro.jit@gmail.com',      '+639170000010'),
      ('Camille Aquino',    'camille.aquino.jit@gmail.com',     '+639170000011'),
      ('Adrian Castillo',   'adrian.castillo.jit@gmail.com',    '+639170000012'),
      ('Elaine Torres',     'elaine.torres.jit@gmail.com',      '+639170000013'),
      ('Francis Ong',       'francis.ong.jit@gmail.com',        '+639170000014'),
      ('Hannah Cruz',       'hannah.cruz.jit@gmail.com',        '+639170000015'),
      ('Kevin Tan',         'kevin.tan.jit@gmail.com',          '+639170000016'),
      ('Leah Domingo',      'leah.domingo.jit@gmail.com',       '+639170000017'),
      ('Nathan Co',         'nathan.co.jit@gmail.com',          '+639170000018'),
      ('Olivia Pascual',    'olivia.pascual.jit@gmail.com',     '+639170000019'),
      ('Rafael Sy',         'rafael.sy.jit@gmail.com',          '+639170000020'),
      ('Samantha Chua',     'samantha.chua.jit@gmail.com',      '+639170000021'),
      ('Tristan Velasco',   'tristan.velasco.jit@gmail.com',    '+639170000022'),
      ('Yvonne Morales',    'yvonne.morales.jit@gmail.com',     '+639170000023'),
      ('Zachary Go',        'zachary.go.jit@gmail.com',         '+639170000024')
    ) as existing_customer(full_name, email, phone)
    union all
    select full_name, email, phone from generated_customers
  loop
    select id into v_customer_id
    from auth.users
    where lower(email) = lower(v_customer.email)
      and not is_sso_user
    limit 1;

    if v_customer_id is null then
      v_customer_id := gen_random_uuid();

      insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, created_at, updated_at, confirmation_token,
      recovery_token, email_change_token_new, email_change,
      email_change_token_current, reauthentication_token,
      is_sso_user, is_anonymous
    ) values (
      '00000000-0000-0000-0000-000000000000'::uuid,
      v_customer_id,
      'authenticated',
      'authenticated',
      v_customer.email,
      extensions.crypt(v_password, extensions.gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object(
        'sub', v_customer_id::text,
        'email', v_customer.email,
        'full_name', v_customer.full_name,
        'phone', v_customer.phone,
        'email_verified', true,
        'phone_verified', false
      ),
      false, now(), now(), '', '', '', '', '', '', false, false
      );
    else
      update auth.users
      set email = v_customer.email,
        encrypted_password = extensions.crypt(v_password, extensions.gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
        raw_user_meta_data = jsonb_build_object(
          'sub', v_customer_id::text,
          'email', v_customer.email,
          'full_name', v_customer.full_name,
          'phone', v_customer.phone,
          'email_verified', true,
          'phone_verified', false
        ),
        updated_at = now()
      where id = v_customer_id;
    end if;

    insert into auth.identities (
      provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      v_customer_id::text,
      v_customer_id,
      jsonb_build_object(
        'sub', v_customer_id::text,
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
    where id = v_customer_id;
  end loop;
end
$$;

-- Operational demo data is anchored to the reset time. It intentionally spans
-- every reservation state used by the admin filters, with several historical
-- bookings and a few live/future holds for availability demos.
-- Keep existing demo holds alive before the statement-level expiry trigger runs,
-- so rerunning this idempotent seed can update the same pending fixtures.
update public.bookings
set hold_expires_at = now() + interval '30 minutes'
where reservation_code like 'JIT-DEMO-%'
  and status = 'pending';

with clock as (
  select (now() at time zone 'Asia/Manila')::date as manila_today
), booking_seed as (
  select * from (values
    ('a1000000-0000-4000-8000-000000000001'::uuid, 'JIT-DEMO-001', 'Maria Santos',      'maria.santos.jit@gmail.com',      now() - interval '30 minutes', 4::smallint, array['SO01','SO02']::text[], 'checked_in'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000002'::uuid, 'JIT-DEMO-002', 'Juan Dela Cruz',    'juan.delacruz.jit@gmail.com',     now() - interval '75 minutes', 5::smallint, array['FD09']::text[], 'checked_in'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000003'::uuid, 'JIT-DEMO-003', 'Angela Reyes',      'angela.reyes.jit@gmail.com',      now() - interval '15 minutes', 3::smallint, array['HC13','HC14','HC15']::text[], 'checked_in'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000004'::uuid, 'JIT-DEMO-004', 'Carlo Mendoza',     'carlo.mendoza.jit@gmail.com',     ((select manila_today from clock)::timestamp + interval '9 hours') at time zone 'Asia/Manila', 3::smallint, array['SO03','SO04']::text[], 'confirmed'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000005'::uuid, 'JIT-DEMO-005', 'Bianca Villanueva', 'bianca.villanueva.jit@gmail.com', ((select manila_today from clock)::timestamp + interval '13 hours') at time zone 'Asia/Manila', 4::smallint, array['FD01','FD02']::text[], 'confirmed'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000006'::uuid, 'JIT-DEMO-006', 'Miguel Bautista',   'miguel.bautista.jit@gmail.com',   ((select manila_today from clock)::timestamp + interval '18 hours') at time zone 'Asia/Manila', 4::smallint, array['GS05']::text[], 'confirmed'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000007'::uuid, 'JIT-DEMO-007', 'Patricia Garcia',   'patricia.garcia.jit@gmail.com',   ((select manila_today from clock)::timestamp + interval '22 hours') at time zone 'Asia/Manila', 4::smallint, array['HC01','HC02']::text[], 'confirmed'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000008'::uuid, 'JIT-DEMO-008', 'Joshua Ramos',      'joshua.ramos.jit@gmail.com',      (((select manila_today from clock) + 1)::timestamp + interval '8 hours') at time zone 'Asia/Manila', 4::smallint, array['SO05','SO06']::text[], 'confirmed'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000009'::uuid, 'JIT-DEMO-009', 'Nicole Flores',     'nicole.flores.jit@gmail.com',     (((select manila_today from clock) + 1)::timestamp + interval '14 hours') at time zone 'Asia/Manila', 4::smallint, array['FD03','FD04','FD05']::text[], 'confirmed'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000010'::uuid, 'JIT-DEMO-010', 'Paolo Navarro',     'paolo.navarro.jit@gmail.com',     (((select manila_today from clock) + 1)::timestamp + interval '20 hours') at time zone 'Asia/Manila', 4::smallint, array['GS09','GS10']::text[], 'confirmed'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000011'::uuid, 'JIT-DEMO-011', 'Camille Aquino',    'camille.aquino.jit@gmail.com',    (((select manila_today from clock) - 1)::timestamp + interval '10 hours') at time zone 'Asia/Manila', 3::smallint, array['HC05']::text[], 'completed'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000012'::uuid, 'JIT-DEMO-012', 'Adrian Castillo',   'adrian.castillo.jit@gmail.com',   (((select manila_today from clock) + 1)::timestamp + interval '11 hours') at time zone 'Asia/Manila', 2::smallint, array['SO07']::text[], 'cancelled'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000013'::uuid, 'JIT-DEMO-013', 'Elaine Torres',     'elaine.torres.jit@gmail.com',     (((select manila_today from clock) + 2)::timestamp + interval '9 hours') at time zone 'Asia/Manila', 2::smallint, array['SO08']::text[], 'pending'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000014'::uuid, 'JIT-DEMO-014', 'Francis Ong',       'francis.ong.jit@gmail.com',       (((select manila_today from clock) + 2)::timestamp + interval '14 hours') at time zone 'Asia/Manila', 3::smallint, array['FD06','FD07']::text[], 'pending'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000015'::uuid, 'JIT-DEMO-015', 'Hannah Cruz',       'hannah.cruz.jit@gmail.com',       (((select manila_today from clock) + 3)::timestamp + interval '18 hours') at time zone 'Asia/Manila', 2::smallint, array['HC03']::text[], 'pending'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000016'::uuid, 'JIT-DEMO-016', 'Kevin Tan',         'kevin.tan.jit@gmail.com',         (((select manila_today from clock) - 2)::timestamp + interval '8 hours') at time zone 'Asia/Manila', 4::smallint, array['GS01','GS02']::text[], 'completed'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000017'::uuid, 'JIT-DEMO-017', 'Leah Domingo',      'leah.domingo.jit@gmail.com',      (((select manila_today from clock) - 3)::timestamp + interval '13 hours') at time zone 'Asia/Manila', 3::smallint, array['SO09']::text[], 'completed'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000018'::uuid, 'JIT-DEMO-018', 'Nathan Co',         'nathan.co.jit@gmail.com',         (((select manila_today from clock) - 5)::timestamp + interval '17 hours') at time zone 'Asia/Manila', 2::smallint, array['FD08']::text[], 'completed'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000019'::uuid, 'JIT-DEMO-019', 'Olivia Pascual',    'olivia.pascual.jit@gmail.com',    (((select manila_today from clock) - 7)::timestamp + interval '10 hours') at time zone 'Asia/Manila', 5::smallint, array['HC06','HC07']::text[], 'completed'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000020'::uuid, 'JIT-DEMO-020', 'Rafael Sy',         'rafael.sy.jit@gmail.com',         (((select manila_today from clock) + 2)::timestamp + interval '12 hours') at time zone 'Asia/Manila', 3::smallint, array['GS03']::text[], 'cancelled'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000021'::uuid, 'JIT-DEMO-021', 'Samantha Chua',     'samantha.chua.jit@gmail.com',     (((select manila_today from clock) - 1)::timestamp + interval '15 hours') at time zone 'Asia/Manila', 2::smallint, array['SO10','SO11']::text[], 'cancelled'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000022'::uuid, 'JIT-DEMO-022', 'Tristan Velasco',   'tristan.velasco.jit@gmail.com',   (((select manila_today from clock) + 4)::timestamp + interval '19 hours') at time zone 'Asia/Manila', 3::smallint, array['FD10']::text[], 'cancelled'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000023'::uuid, 'JIT-DEMO-023', 'Yvonne Morales',    'yvonne.morales.jit@gmail.com',    now() - interval '50 minutes', 4::smallint, array['GS06']::text[], 'checked_in'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000024'::uuid, 'JIT-DEMO-024', 'Zachary Go',        'zachary.go.jit@gmail.com',        now() - interval '25 minutes', 3::smallint, array['SO12']::text[], 'checked_in'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000025'::uuid, 'JIT-DEMO-025', 'Elaine Torres',     'elaine.torres.jit@gmail.com',     (((select manila_today from clock) - 1)::timestamp + interval '9 hours') at time zone 'Asia/Manila', 2::smallint, array['FD06']::text[], 'no_show'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000026'::uuid, 'JIT-DEMO-026', 'Francis Ong',       'francis.ong.jit@gmail.com',       (((select manila_today from clock) - 4)::timestamp + interval '14 hours') at time zone 'Asia/Manila', 3::smallint, array['HC08']::text[], 'no_show'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000027'::uuid, 'JIT-DEMO-027', 'Hannah Cruz',       'hannah.cruz.jit@gmail.com',       (((select manila_today from clock) - 6)::timestamp + interval '18 hours') at time zone 'Asia/Manila', 2::smallint, array['GS07','GS08']::text[], 'no_show'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000028'::uuid, 'JIT-DEMO-028', 'Kevin Tan',         'kevin.tan.jit@gmail.com',         (((select manila_today from clock) + 1)::timestamp + interval '16 hours') at time zone 'Asia/Manila', 2::smallint, array['FD07']::text[], 'declined'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000029'::uuid, 'JIT-DEMO-029', 'Leah Domingo',      'leah.domingo.jit@gmail.com',      (((select manila_today from clock) - 2)::timestamp + interval '11 hours') at time zone 'Asia/Manila', 4::smallint, array['SO08']::text[], 'declined'::public.booking_status),
    ('a1000000-0000-4000-8000-000000000030'::uuid, 'JIT-DEMO-030', 'Nathan Co',         'nathan.co.jit@gmail.com',         (((select manila_today from clock) + 3)::timestamp + interval '20 hours') at time zone 'Asia/Manila', 2::smallint, array['HC09','HC10']::text[], 'declined'::public.booking_status)
  ) as seeded(id, reservation_code, guest_name, guest_email, starts_at, duration_hours, seat_ids, status)
)
insert into public.bookings (
  id, reservation_code, user_id, guest_name, guest_email, booking_date,
  start_time, starts_at, ends_at, duration_hours, space, seat_ids,
  status, payment_status, subtotal_cents, hold_expires_at, cancelled_at,
  cancellation_reason, confirmation_email_sent_at, created_at, updated_at
)
select
  booking_seed.id,
  booking_seed.reservation_code,
  profile.id,
  booking_seed.guest_name,
  booking_seed.guest_email,
  (booking_seed.starts_at at time zone 'Asia/Manila')::date,
  (booking_seed.starts_at at time zone 'Asia/Manila')::time,
  booking_seed.starts_at,
  booking_seed.starts_at + make_interval(hours => booking_seed.duration_hours),
  booking_seed.duration_hours,
  'study-seat',
  booking_seed.seat_ids,
  booking_seed.status,
  case
    when booking_seed.status = 'pending' then 'pending'::public.payment_status
    when booking_seed.status = 'declined' then 'failed'::public.payment_status
    else 'not_required'::public.payment_status
  end,
  cardinality(booking_seed.seat_ids) * booking_seed.duration_hours * 5000,
  case when booking_seed.status = 'pending' then now() + interval '30 minutes' end,
  case when booking_seed.status = 'cancelled' then now() - interval '2 hours' end,
  case when booking_seed.status = 'cancelled' then 'Customer schedule changed' end,
  case when booking_seed.status in ('confirmed', 'checked_in', 'completed') then least(booking_seed.starts_at - interval '1 day', now() - interval '2 hours') end,
  least(booking_seed.starts_at - interval '2 days', now() - interval '3 hours'),
  now()
from booking_seed
join public.profiles profile on lower(profile.email) = lower(booking_seed.guest_email)
on conflict (id) do update
set guest_name = excluded.guest_name,
    guest_email = excluded.guest_email,
    user_id = excluded.user_id,
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
where booking.reservation_code like 'JIT-DEMO-%'
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
  ('c1000000-0000-4000-8000-000000000003'::uuid, 'a1000000-0000-4000-8000-000000000003'::uuid),
  ('c1000000-0000-4000-8000-000000000011'::uuid, 'a1000000-0000-4000-8000-000000000011'::uuid),
  ('c1000000-0000-4000-8000-000000000016'::uuid, 'a1000000-0000-4000-8000-000000000016'::uuid),
  ('c1000000-0000-4000-8000-000000000017'::uuid, 'a1000000-0000-4000-8000-000000000017'::uuid),
  ('c1000000-0000-4000-8000-000000000018'::uuid, 'a1000000-0000-4000-8000-000000000018'::uuid),
  ('c1000000-0000-4000-8000-000000000019'::uuid, 'a1000000-0000-4000-8000-000000000019'::uuid),
  ('c1000000-0000-4000-8000-000000000023'::uuid, 'a1000000-0000-4000-8000-000000000023'::uuid),
  ('c1000000-0000-4000-8000-000000000024'::uuid, 'a1000000-0000-4000-8000-000000000024'::uuid)
) as pass(id, booking_id)
join public.bookings booking on booking.id = pass.booking_id
on conflict (booking_id) do update
set expires_at = excluded.expires_at,
    revoked_at = null;

insert into public.check_in_sessions (
  id, booking_id, qr_access_pass_id, status, checked_in_at, checked_out_at, scheduled_end_at
)
select
  session.id,
  session.booking_id,
  pass.id,
  session.status::public.check_in_status,
  booking.starts_at + interval '5 minutes',
  case when session.status = 'checked_out' then booking.ends_at - interval '10 minutes' end,
  booking.ends_at
from (values
  ('d1000000-0000-4000-8000-000000000001'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid, 'checked_in'::text),
  ('d1000000-0000-4000-8000-000000000002'::uuid, 'a1000000-0000-4000-8000-000000000002'::uuid, 'checked_in'::text),
  ('d1000000-0000-4000-8000-000000000003'::uuid, 'a1000000-0000-4000-8000-000000000003'::uuid, 'checked_in'::text),
  ('d1000000-0000-4000-8000-000000000011'::uuid, 'a1000000-0000-4000-8000-000000000011'::uuid, 'checked_out'::text),
  ('d1000000-0000-4000-8000-000000000016'::uuid, 'a1000000-0000-4000-8000-000000000016'::uuid, 'checked_out'::text),
  ('d1000000-0000-4000-8000-000000000017'::uuid, 'a1000000-0000-4000-8000-000000000017'::uuid, 'checked_out'::text),
  ('d1000000-0000-4000-8000-000000000018'::uuid, 'a1000000-0000-4000-8000-000000000018'::uuid, 'checked_out'::text),
  ('d1000000-0000-4000-8000-000000000019'::uuid, 'a1000000-0000-4000-8000-000000000019'::uuid, 'checked_out'::text),
  ('d1000000-0000-4000-8000-000000000023'::uuid, 'a1000000-0000-4000-8000-000000000023'::uuid, 'checked_in'::text),
  ('d1000000-0000-4000-8000-000000000024'::uuid, 'a1000000-0000-4000-8000-000000000024'::uuid, 'checked_in'::text)
) as session(id, booking_id, status)
join public.bookings booking on booking.id = session.booking_id
join public.qr_access_passes pass on pass.booking_id = session.booking_id
on conflict (booking_id) do update
set qr_access_pass_id = excluded.qr_access_pass_id,
    status = excluded.status,
    checked_in_at = excluded.checked_in_at,
    checked_out_at = excluded.checked_out_at,
    scheduled_end_at = excluded.scheduled_end_at,
    overtime_minutes = 0,
    overtime_charge_cents = 0;

-- Current walk-ins make the admin live floor plan less uniform. They use seats
-- that are not occupied by the live checked-in reservations above.
insert into public.walk_in_occupancies (
  id, seat_id, guest_name, started_at, business_date, status, payment_status,
  notes, created_by
)
select
  walk_in.id,
  seat.id,
  walk_in.guest_name,
  now() - walk_in.elapsed,
  ((((now() - walk_in.elapsed) at time zone 'Asia/Manila') - interval '8 hours')::date),
  'active',
  'unpaid',
  walk_in.notes,
  creator.id
from (values
  ('e1000000-0000-4000-8000-000000000001'::uuid, 'HC11', 'Liza Manalo',      interval '40 minutes', 'Needs a charging adapter'::text, 'admin@jit-studyhub.com'::text),
  ('e1000000-0000-4000-8000-000000000002'::uuid, 'HC12', 'Mark Evangelista', interval '20 minutes', null::text, 'ramon.deleon@jit-studyhub.com'::text),
  ('e1000000-0000-4000-8000-000000000003'::uuid, 'GS01', 'Denise Abad',      interval '95 minutes', 'Waiting for two classmates'::text, 'andrea.lim@jit-studyhub.com'::text),
  ('e1000000-0000-4000-8000-000000000004'::uuid, 'FD07', 'Noel Santiago',    interval '12 minutes', null::text, 'mikaela.soriano@jit-studyhub.com'::text)
) as walk_in(id, seat_code, guest_name, elapsed, notes, creator_email)
join public.seats seat on seat.code = walk_in.seat_code
join public.profiles creator on lower(creator.email) = lower(walk_in.creator_email)
on conflict (id) do update
set seat_id = excluded.seat_id,
    guest_name = excluded.guest_name,
    started_at = excluded.started_at,
    business_date = excluded.business_date,
    ended_at = null,
    ended_by = null,
    status = 'active',
    rate_plan_id = null,
    service_name = null,
    billable_minutes = null,
    listed_price_cents = null,
    charged_amount_cents = null,
    payment_method = null,
    payment_status = 'unpaid',
    price_override_reason = null,
    notes = excluded.notes,
    created_by = excluded.created_by;

-- Completed walk-ins provide believable service and payment history for the
-- walk-in table and business-report date ranges.
with clock as (
  select (now() at time zone 'Asia/Manila')::date as manila_today
), walk_in_seed as (
  select * from (values
    ('e2000000-0000-4000-8000-000000000001'::uuid, 'SO03', 'Alyssa Robles',   -1, 9,  48,  'hour-1',    'cash',  'paid',   8000::bigint,  'Printed two review packets', 'andrea.lim@jit-studyhub.com'),
    ('e2000000-0000-4000-8000-000000000002'::uuid, 'FD03', 'Bryan Ching',    -1, 11, 115, 'hours-2',   'gcash', 'paid',  12000::bigint, null, 'ramon.deleon@jit-studyhub.com'),
    ('e2000000-0000-4000-8000-000000000003'::uuid, 'HC04', 'Clarisse Uy',    -1, 15, 172, 'hours-3',   'qrph',  'paid',  15000::bigint, null, 'mikaela.soriano@jit-studyhub.com'),
    ('e2000000-0000-4000-8000-000000000004'::uuid, 'GS04', 'Diego Ramos',    -2, 10, 225, 'hours-4',   'cash',  'paid',  17000::bigint, 'Group thesis discussion', 'andrea.lim@jit-studyhub.com'),
    ('e2000000-0000-4000-8000-000000000005'::uuid, 'SO06', 'Erika Flores',   -2, 14, 286, 'hours-5',   'gcash', 'paid',  20000::bigint, null, 'ramon.deleon@jit-studyhub.com'),
    ('e2000000-0000-4000-8000-000000000006'::uuid, 'FD05', 'Gian Mercado',   -3, 8,  355, 'hours-6',   'qrph',  'paid',  23000::bigint, 'Board exam review', 'mikaela.soriano@jit-studyhub.com'),
    ('e2000000-0000-4000-8000-000000000007'::uuid, 'HC06', 'Hazel Aquino',   -3, 13, 430, 'hours-7-8', 'cash',  'paid',  27000::bigint, null, 'andrea.lim@jit-studyhub.com'),
    ('e2000000-0000-4000-8000-000000000008'::uuid, 'GS08', 'Ivan Bautista',  -4, 9,  525, 'hours-9-10','gcash', 'paid',  32000::bigint, 'Capstone work session', 'ramon.deleon@jit-studyhub.com'),
    ('e2000000-0000-4000-8000-000000000009'::uuid, 'SO10', 'Julia Navarro',  -5, 10,  62, 'hours-2',   'cash',  'paid',  12000::bigint, null, 'mikaela.soriano@jit-studyhub.com'),
    ('e2000000-0000-4000-8000-000000000010'::uuid, 'FD09', 'Kurt Villarin',  -6, 16, 138, 'hours-3',   'qrph',  'paid',  15000::bigint, null, 'andrea.lim@jit-studyhub.com'),
    ('e2000000-0000-4000-8000-000000000011'::uuid, 'HC01', 'Mae de Guzman',  -7, 12, 205, 'hours-4',   'gcash', 'paid',  17000::bigint, 'Online interview preparation', 'ramon.deleon@jit-studyhub.com'),
    ('e2000000-0000-4000-8000-000000000012'::uuid, 'GS11', 'Nico Salazar',   -8, 9,  275, 'hours-5',   'cash',  'unpaid',20000::bigint, 'Payment follow-up required', 'mikaela.soriano@jit-studyhub.com'),
    ('e2000000-0000-4000-8000-000000000013'::uuid, 'SO02', 'Phoebe Castro',  -9, 13,  52, 'hour-1',    'gcash', 'paid',   8000::bigint, null, 'andrea.lim@jit-studyhub.com'),
    ('e2000000-0000-4000-8000-000000000014'::uuid, 'FD01', 'Renzo Lim',     -10, 8,  610, 'whole-day', 'qrph',  'paid',  37000::bigint, 'Whole-day remote work', 'ramon.deleon@jit-studyhub.com'),
    ('e2000000-0000-4000-8000-000000000015'::uuid, 'HC15', 'Sheila Go',     -12, 17,  95, 'hours-2',   'cash',  'paid',  12000::bigint, null, 'mikaela.soriano@jit-studyhub.com')
  ) as seeded(id, seat_code, guest_name, day_offset, start_hour, duration_minutes,
    rate_code, payment_method, payment_status, charged_amount_cents, notes, creator_email)
)
insert into public.walk_in_occupancies (
  id, seat_id, guest_name, started_at, ended_at, business_date, status,
  rate_plan_id, service_name, billable_minutes, listed_price_cents,
  charged_amount_cents, payment_method, payment_status, notes,
  created_by, ended_by, created_at, updated_at
)
select
  walk_in.id,
  seat.id,
  walk_in.guest_name,
  (((clock.manila_today + walk_in.day_offset)::timestamp
    + make_interval(hours => walk_in.start_hour)) at time zone 'Asia/Manila'),
  (((clock.manila_today + walk_in.day_offset)::timestamp
    + make_interval(hours => walk_in.start_hour, mins => walk_in.duration_minutes)) at time zone 'Asia/Manila'),
  clock.manila_today + walk_in.day_offset,
  'completed',
  rate.id,
  rate.name,
  walk_in.duration_minutes,
  rate.price_cents,
  walk_in.charged_amount_cents,
  walk_in.payment_method,
  walk_in.payment_status,
  walk_in.notes,
  creator.id,
  creator.id,
  (((clock.manila_today + walk_in.day_offset)::timestamp
    + make_interval(hours => walk_in.start_hour)) at time zone 'Asia/Manila'),
  now()
from walk_in_seed walk_in
cross join clock
join public.seats seat on seat.code = walk_in.seat_code
join public.service_rate_plans rate on rate.code = walk_in.rate_code
join public.profiles creator on lower(creator.email) = lower(walk_in.creator_email)
on conflict (id) do update
set seat_id = excluded.seat_id,
    guest_name = excluded.guest_name,
    started_at = excluded.started_at,
    ended_at = excluded.ended_at,
    business_date = excluded.business_date,
    status = excluded.status,
    rate_plan_id = excluded.rate_plan_id,
    service_name = excluded.service_name,
    billable_minutes = excluded.billable_minutes,
    listed_price_cents = excluded.listed_price_cents,
    charged_amount_cents = excluded.charged_amount_cents,
    payment_method = excluded.payment_method,
    payment_status = excluded.payment_status,
    notes = excluded.notes,
    created_by = excluded.created_by,
    ended_by = excluded.ended_by,
    updated_at = now();

insert into public.hub_content (slug, title, body, status, published_at)
values (
  'welcome',
  'Just In Time Study Hub and Coworking Space',
  '{"summary":"A focused, comfortable place to study and work."}'::jsonb,
  'published',
  now()
)
on conflict (slug) do nothing;

insert into public.announcements (title, body, status, starts_at, created_by)
select seed.title, seed.body, seed.status::public.content_status, seed.starts_at, creator.id
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
    'Weekday student discount now available',
    'Present a valid student ID at the front desk from Monday to Thursday to receive the current student rate on eligible walk-in sessions.',
    'published'::text,
    (current_date - 4)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'Community study sprint this Friday',
    'Join a guided 50-minute focus session this Friday evening, followed by a short break and an optional goal-setting check-in.',
    'published'::text,
    (current_date - 7)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'New group study tables are ready',
    'Our collaboration area now has additional group tables with nearby power outlets. Please keep group discussions within this designated zone.',
    'published'::text,
    (current_date - 9)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'Charging cables available at the front desk',
    'USB-C, Lightning, and Micro-USB charging cables can now be borrowed at the front desk during your active session, subject to availability.',
    'published'::text,
    (current_date - 15)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'Reservation grace period reminder',
    'Reserved seats are held for 15 minutes after the scheduled start time. Let the front desk know if you expect to arrive late.',
    'published'::text,
    (current_date - 22)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'Complimentary water station installed',
    'A new filtered drinking-water station is available beside the pantry. Guests are encouraged to bring a reusable bottle.',
    'published'::text,
    (current_date - 31)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'Online booking confirmation reminder',
    'Please check your inbox after reserving and keep your reservation code ready for a faster check-in at the front desk.',
    'published'::text,
    (current_date - 35)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'More desk lamps in the solo section',
    'We added adjustable desk lamps to the individual study area for more comfortable evening and late-night sessions.',
    'published'::text,
    (current_date - 46)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'Personal lockers open for daily use',
    'A limited number of day-use lockers are now available. Ask the front desk about availability when you check in.',
    'published'::text,
    (current_date - 57)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'Collaboration zone reminder',
    'Group discussions and online meetings are welcome in the collaboration zone. Please use headphones and keep voices moderate elsewhere.',
    'published'::text,
    (current_date - 69)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'Freshly brewed coffee schedule',
    'Fresh coffee is prepared at opening, noon, and early evening. Additional batches may be served during busy study periods.',
    'published'::text,
    (current_date - 88)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'Late-night safety reminder',
    'Guests leaving after midnight may ask the front desk for assistance arranging a pickup point near the entrance.',
    'published'::text,
    (current_date - 101)::timestamp at time zone 'Asia/Manila'
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
  ),
  (
    'Mock board exam registration',
    'Registration details and seat allocation for the next mock board exam are still being finalized.',
    'draft'::text,
    (current_date + 7)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'New snack bar menu preview',
    'A refreshed snack and beverage menu is being prepared for review before it is shared with guests.',
    'draft'::text,
    (current_date + 9)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'November membership offer',
    'Proposed membership bundles and early-renewal benefits are pending final approval from management.',
    'draft'::text,
    (current_date + 16)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'Career coaching workshop',
    'Workshop timing, facilitator details, and the registration link will be added before publication.',
    'draft'::text,
    (current_date + 20)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'Quiet zone policy refresh',
    'The revised quiet-zone guidelines are being reviewed by the operations team.',
    'draft'::text,
    (current_date + 24)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'Power interruption advisory resolved',
    'The announced maintenance interruption ended on schedule and normal hub operations resumed.',
    'archived'::text,
    (current_date - 44)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'September review marathon',
    'The review marathon promotion has ended. Thank you to everyone who joined the extended study sessions.',
    'archived'::text,
    (current_date - 61)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'Founders week discount',
    'The founders week hourly-rate discount is no longer active.',
    'archived'::text,
    (current_date - 83)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'Pantry renovation update',
    'Pantry improvements were completed and the full refreshment area is open again.',
    'archived'::text,
    (current_date - 108)::timestamp at time zone 'Asia/Manila'
  ),
  (
    'Summer study pass offer',
    'The seasonal summer study pass promotion has concluded.',
    'archived'::text,
    (current_date - 142)::timestamp at time zone 'Asia/Manila'
  )
) as seed(title, body, status, starts_at)
cross join public.profiles creator
where not exists (
  select 1 from public.announcements existing where existing.title = seed.title
)
  and lower(creator.email) = 'sofia.mercado@jit-studyhub.com';

-- A varied, idempotent audit trail powers the owner-only Access Logs page.
-- Entity/action pairs are stable so rerunning the seed refreshes no duplicates.
with access_log_seed as (
  select * from (values
    ('admin@jit-studyhub.com',         'Signed in',                    'admin_session', 'owner-session-morning',  18,   '{"channel":"password","result":"success"}'::jsonb),
    ('andrea.lim@jit-studyhub.com',    'Signed in',                    'admin_session', 'andrea-session-morning', 42,   '{"channel":"password","result":"success"}'::jsonb),
    ('ramon.deleon@jit-studyhub.com',  'Opened seating dashboard',     'admin_session', 'ramon-seat-dashboard',   55,   '{"section":"dashboard"}'::jsonb),
    ('sofia.mercado@jit-studyhub.com', 'Opened announcements',         'admin_session', 'sofia-announcements',    75,   '{"section":"announcements"}'::jsonb),
    ('mikaela.soriano@jit-studyhub.com','Signed in',                   'admin_session', 'mikaela-session',         96,   '{"channel":"password","result":"success"}'::jsonb),
    ('admin@jit-studyhub.com',         'Opened access logs',           'admin_session', 'owner-access-logs',       125,  '{"section":"logs"}'::jsonb),
    ('andrea.lim@jit-studyhub.com',    'Walk-in checked in',           'walk_in',       'e1000000-0000-4000-8000-000000000003', 140, '{"seat_code":"GS01","guest_name":"Denise Abad"}'::jsonb),
    ('ramon.deleon@jit-studyhub.com',  'Walk-in checked in',           'walk_in',       'e1000000-0000-4000-8000-000000000002', 155, '{"seat_code":"HC12","guest_name":"Mark Evangelista"}'::jsonb),
    ('mikaela.soriano@jit-studyhub.com','Walk-in checked out',         'walk_in',       'e2000000-0000-4000-8000-000000000001', 260, '{"seat_code":"SO03","payment_method":"cash","payment_status":"paid"}'::jsonb),
    ('andrea.lim@jit-studyhub.com',    'Walk-in checked out',          'walk_in',       'e2000000-0000-4000-8000-000000000002', 330, '{"seat_code":"FD03","payment_method":"gcash","payment_status":"paid"}'::jsonb),
    ('admin@jit-studyhub.com',         'Cancelled reservation',        'booking',       'a1000000-0000-4000-8000-000000000020', 390, '{"reservation_code":"JIT-DEMO-020","reason":"Customer requested a different date"}'::jsonb),
    ('andrea.lim@jit-studyhub.com',    'Viewed reservation',           'booking',       'a1000000-0000-4000-8000-000000000013', 430, '{"reservation_code":"JIT-DEMO-013"}'::jsonb),
    ('mikaela.soriano@jit-studyhub.com','Checked in reservation',      'booking',       'a1000000-0000-4000-8000-000000000023', 510, '{"reservation_code":"JIT-DEMO-023","seat_codes":["GS06"]}'::jsonb),
    ('ramon.deleon@jit-studyhub.com',  'Checked in reservation',       'booking',       'a1000000-0000-4000-8000-000000000024', 535, '{"reservation_code":"JIT-DEMO-024","seat_codes":["SO12"]}'::jsonb),
    ('sofia.mercado@jit-studyhub.com', 'Published announcement',       'announcement',  'october-focus-week-schedule',     720, '{"title":"October focus-week schedule"}'::jsonb),
    ('sofia.mercado@jit-studyhub.com', 'Saved announcement draft',     'announcement',  'mock-board-exam-registration',    890, '{"title":"Mock board exam registration"}'::jsonb),
    ('sofia.mercado@jit-studyhub.com', 'Archived announcement',        'announcement',  'power-interruption-resolved',     1320,'{"title":"Power interruption advisory resolved"}'::jsonb),
    ('admin@jit-studyhub.com',         'Viewed analytics dashboard',   'analytics',     'daily-business-report',           1510,'{"range":"last_30_days"}'::jsonb),
    ('admin@jit-studyhub.com',         'Created employee account',     'profile',       'jerome.valdez@jit-studyhub.com',  1840,'{"role":"staff"}'::jsonb),
    ('admin@jit-studyhub.com',         'Updated employee permissions', 'profile',       'mikaela.soriano@jit-studyhub.com',2160,'{"permissions":["seating","reservations"]}'::jsonb),
    ('andrea.lim@jit-studyhub.com',    'Completed reservation',        'booking',       'a1000000-0000-4000-8000-000000000016', 2880, '{"reservation_code":"JIT-DEMO-016"}'::jsonb),
    ('ramon.deleon@jit-studyhub.com',  'Marked reservation no show',   'booking',       'a1000000-0000-4000-8000-000000000025', 3120, '{"reservation_code":"JIT-DEMO-025"}'::jsonb),
    ('admin@jit-studyhub.com',         'Declined reservation',         'booking',       'a1000000-0000-4000-8000-000000000029', 4200, '{"reservation_code":"JIT-DEMO-029","reason":"Payment window expired"}'::jsonb),
    ('sofia.mercado@jit-studyhub.com', 'Archived announcement',        'announcement',  'september-review-marathon',       5760, '{"title":"September review marathon"}'::jsonb),
    ('admin@jit-studyhub.com',         'Signed out',                   'admin_session', 'owner-session-evening',          6480, '{"result":"success"}'::jsonb)
  ) as seeded(actor_email, action, entity_type, entity_id, minutes_ago, details)
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, details, created_at)
select actor.id, seed.action, seed.entity_type, seed.entity_id, seed.details,
  now() - make_interval(mins => seed.minutes_ago)
from access_log_seed seed
join public.profiles actor on lower(actor.email) = lower(seed.actor_email)
where not exists (
  select 1
  from public.audit_logs existing
  where existing.action = seed.action
    and existing.entity_type = seed.entity_type
    and existing.entity_id = seed.entity_id
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

select set_config('jit.seed_mode', 'off', false);
