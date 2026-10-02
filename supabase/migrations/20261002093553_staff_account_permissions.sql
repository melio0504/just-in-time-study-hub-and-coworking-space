-- Owner-only administration and scoped employee access.

create type public.staff_permission as enum (
  'seating',
  'reservations',
  'announcements'
);

alter table public.profiles
  add column staff_permissions public.staff_permission[] not null default '{}',
  add column must_change_password boolean not null default false;

-- Preserve existing staff access while moving to explicit scopes. The
-- designated owner is the only account that retains the admin role.
update public.profiles
set staff_permissions = array[
  'seating'::public.staff_permission,
  'reservations'::public.staff_permission,
  'announcements'::public.staff_permission
]
where role = 'staff'
   or (role = 'admin' and lower(coalesce(email, '')) <> 'admin@jit-studyhub.com');

update public.profiles
set role = 'staff'
where role = 'admin'
  and lower(coalesce(email, '')) <> 'admin@jit-studyhub.com';

update public.profiles
set role = 'admin',
    staff_permissions = '{}',
    must_change_password = false
where lower(email) = 'admin@jit-studyhub.com';

alter table public.profiles
  add constraint profiles_staff_permissions_required check (
    role <> 'staff' or cardinality(staff_permissions) > 0
  ),
  add constraint profiles_admin_email check (
    role <> 'admin' or lower(email) = 'admin@jit-studyhub.com'
  );

create unique index profiles_single_admin_idx
  on public.profiles (role)
  where role = 'admin';

-- The account-creation Edge Function uses the service role for these exact
-- operations. RLS bypass alone does not grant table privileges.
grant select, update on public.profiles to service_role;
grant insert on public.audit_logs to service_role;

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and lower(email) = 'admin@jit-studyhub.com'
      and is_active
      and not must_change_password
  ), false);
$$;

create function private.is_staff_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role in ('staff', 'admin')
      and is_active
      and not must_change_password
  ), false);
$$;

create function private.has_staff_permission(p_permission public.staff_permission) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and is_active
      and not must_change_password
      and (
        (role = 'admin' and lower(email) = 'admin@jit-studyhub.com')
        or (role = 'staff' and p_permission = any(staff_permissions))
      )
  ), false);
$$;

revoke execute on function private.is_staff_member() from public, anon, authenticated, service_role;
revoke execute on function private.has_staff_permission(public.staff_permission) from public, anon, authenticated, service_role;
grant execute on function private.is_staff_member() to authenticated;
grant execute on function private.has_staff_permission(public.staff_permission) to authenticated;

-- Clear the first-login requirement only after Supabase Auth actually changes
-- the employee's password.
create function private.mark_initial_password_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    update public.profiles
    set must_change_password = false
    where id = new.id
      and role = 'staff'
      and must_change_password;

    if found then
      insert into public.audit_logs (actor_id, action, entity_type, entity_id)
      values (new.id, 'Changed initial password', 'staff_account', new.id::text);
    end if;
  end if;

  return new;
end;
$$;

create trigger auth_user_initial_password_changed
after update of encrypted_password on auth.users
for each row execute function private.mark_initial_password_changed();

-- Replace broad staff policies with capability-specific checks.
drop policy "Users read own profile; staff read all" on public.profiles;
create policy "Users read own profile; owner reads all"
on public.profiles for select to authenticated
using ((select auth.uid()) = id or (select private.is_admin()));

drop policy "Users read active seats; staff read all" on public.seats;
create policy "Users read active seats; seating staff read all"
on public.seats for select to authenticated
using (is_active or (select private.has_staff_permission('seating')));

drop policy "Users read own bookings; staff read all" on public.bookings;
create policy "Users read own bookings; operations staff read all"
on public.bookings for select to authenticated
using (
  (select auth.uid()) = user_id
  or (select private.has_staff_permission('seating'))
  or (select private.has_staff_permission('reservations'))
);

drop policy "Staff update bookings" on public.bookings;
create policy "Reservation staff update bookings"
on public.bookings for update to authenticated
using ((select private.has_staff_permission('reservations')))
with check ((select private.has_staff_permission('reservations')));

drop policy "Users read own booking seats; staff read all" on public.booking_seats;
create policy "Users read own booking seats; operations staff read all"
on public.booking_seats for select to authenticated using (
  exists (
    select 1 from public.bookings
    where bookings.id = booking_seats.booking_id
      and (
        bookings.user_id = (select auth.uid())
        or (select private.has_staff_permission('seating'))
        or (select private.has_staff_permission('reservations'))
      )
  )
);

drop policy "Users read own payments; staff read all" on public.payments;
create policy "Users read own payments; reservation staff read all"
on public.payments for select to authenticated using (
  exists (
    select 1 from public.bookings
    where bookings.id = payments.booking_id
      and (
        bookings.user_id = (select auth.uid())
        or (select private.has_staff_permission('reservations'))
      )
  )
);

drop policy "Staff insert payments" on public.payments;
drop policy "Staff update payments" on public.payments;
drop policy "Staff delete payments" on public.payments;
create policy "Reservation staff insert payments" on public.payments for insert to authenticated
with check ((select private.has_staff_permission('reservations')));
create policy "Reservation staff update payments" on public.payments for update to authenticated
using ((select private.has_staff_permission('reservations')))
with check ((select private.has_staff_permission('reservations')));
create policy "Owner deletes payments" on public.payments for delete to authenticated
using ((select private.is_admin()));

drop policy "Users read own QR pass metadata; staff read all" on public.qr_access_passes;
create policy "Users read own QR pass metadata; reservation staff read all"
on public.qr_access_passes for select to authenticated using (
  exists (
    select 1 from public.bookings
    where bookings.id = qr_access_passes.booking_id
      and (
        bookings.user_id = (select auth.uid())
        or (select private.has_staff_permission('reservations'))
      )
  )
);

drop policy "Staff insert QR passes" on public.qr_access_passes;
drop policy "Staff update QR passes" on public.qr_access_passes;
drop policy "Staff delete QR passes" on public.qr_access_passes;
create policy "Reservation staff insert QR passes" on public.qr_access_passes for insert to authenticated
with check ((select private.has_staff_permission('reservations')));
create policy "Reservation staff update QR passes" on public.qr_access_passes for update to authenticated
using ((select private.has_staff_permission('reservations')))
with check ((select private.has_staff_permission('reservations')));
create policy "Owner deletes QR passes" on public.qr_access_passes for delete to authenticated
using ((select private.is_admin()));

drop policy "Users read own check-ins; staff read all" on public.check_in_sessions;
create policy "Users read own check-ins; reservation staff read all"
on public.check_in_sessions for select to authenticated using (
  exists (
    select 1 from public.bookings
    where bookings.id = check_in_sessions.booking_id
      and (
        bookings.user_id = (select auth.uid())
        or (select private.has_staff_permission('reservations'))
      )
  )
);

drop policy "Staff insert check-ins" on public.check_in_sessions;
drop policy "Staff update check-ins" on public.check_in_sessions;
drop policy "Staff delete check-ins" on public.check_in_sessions;
create policy "Reservation staff insert check-ins" on public.check_in_sessions for insert to authenticated
with check ((select private.has_staff_permission('reservations')));
create policy "Reservation staff update check-ins" on public.check_in_sessions for update to authenticated
using ((select private.has_staff_permission('reservations')))
with check ((select private.has_staff_permission('reservations')));
create policy "Owner deletes check-ins" on public.check_in_sessions for delete to authenticated
using ((select private.is_admin()));

drop policy "Users read current announcements; staff read all" on public.announcements;
create policy "Users read current announcements; announcement staff read all"
on public.announcements for select to authenticated using (
  (
    status = 'published'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  )
  or (select private.has_staff_permission('announcements'))
);

drop policy "Staff insert announcements" on public.announcements;
drop policy "Staff update announcements" on public.announcements;
drop policy "Staff delete announcements" on public.announcements;
create policy "Announcement staff insert announcements" on public.announcements for insert to authenticated
with check ((select private.has_staff_permission('announcements')));
create policy "Announcement staff update announcements" on public.announcements for update to authenticated
using ((select private.has_staff_permission('announcements')))
with check ((select private.has_staff_permission('announcements')));
create policy "Announcement staff delete announcements" on public.announcements for delete to authenticated
using ((select private.has_staff_permission('announcements')));

drop policy "Staff read walk-in occupancies" on public.walk_in_occupancies;
create policy "Seating staff read walk-in occupancies"
on public.walk_in_occupancies for select to authenticated
using ((select private.has_staff_permission('seating')));

drop policy "Staff read business metrics" on public.daily_business_metrics;
create policy "Owner reads business metrics"
on public.daily_business_metrics for select to authenticated
using ((select private.is_admin()));

-- Audit and analytics policies already call private.is_admin(), which now
-- means the single owner rather than every staff account.

create or replace function private.toggle_walk_in_occupancy(
  p_seat_code text,
  p_guest_name text default null
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_seat_id uuid;
  v_occupancy_id uuid;
begin
  if v_actor is null or not private.has_staff_permission('seating') then
    raise exception 'Seating access required' using errcode = '42501';
  end if;

  select id into v_seat_id
  from public.seats
  where code = upper(btrim(p_seat_code)) and is_active
  for update;

  if v_seat_id is null then
    raise exception 'Seat not found' using errcode = 'P0001';
  end if;

  select id into v_occupancy_id
  from public.walk_in_occupancies
  where seat_id = v_seat_id and ended_at is null
  for update;

  if v_occupancy_id is not null then
    update public.walk_in_occupancies
    set ended_at = now(), ended_by = v_actor
    where id = v_occupancy_id;

    insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
    values (v_actor, 'Walk-in checked out', 'seat', p_seat_code, jsonb_build_object('occupancy_id', v_occupancy_id));
    return false;
  end if;

  insert into public.walk_in_occupancies (seat_id, guest_name, created_by)
  values (v_seat_id, nullif(btrim(p_guest_name), ''), v_actor)
  returning id into v_occupancy_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (v_actor, 'Walk-in checked in', 'seat', p_seat_code, jsonb_build_object('occupancy_id', v_occupancy_id));
  return true;
end;
$$;

create or replace function private.log_admin_access(p_action text default 'Signed in') returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null or not private.is_staff_member() then
    raise exception 'Staff access required' using errcode = '42501';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id)
  values (v_actor, left(coalesce(nullif(btrim(p_action), ''), 'Signed in'), 120), 'admin_session', v_actor::text);
end;
$$;

create or replace function private.admin_cancel_booking(p_booking_id uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null or not private.has_staff_permission('reservations') then
    raise exception 'Reservation access required' using errcode = '42501';
  end if;

  update public.bookings
  set status = 'cancelled',
      cancelled_at = now(),
      cancellation_reason = coalesce(nullif(btrim(p_reason), ''), 'Cancelled by staff')
  where id = p_booking_id
    and status not in ('cancelled', 'completed', 'declined', 'no_show');

  if not found then
    raise exception 'Booking cannot be cancelled' using errcode = 'P0001';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (
    v_actor,
    'Cancelled reservation',
    'booking',
    p_booking_id::text,
    jsonb_build_object('reason', coalesce(nullif(btrim(p_reason), ''), 'Cancelled by staff'))
  );
end;
$$;
