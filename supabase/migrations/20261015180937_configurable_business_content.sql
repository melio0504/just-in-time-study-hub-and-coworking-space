SET local check_function_bodies = off;

DROP POLICY "Operations staff read service rates" ON "public"."service_rate_plans";

CREATE TABLE "public"."booking_settings" (
  "singleton"              boolean                  NOT NULL DEFAULT true,
  "max_seats_per_booking"  smallint                 NOT NULL DEFAULT 5,
  "min_duration_hours"     smallint                 NOT NULL DEFAULT 1,
  "max_duration_hours"     smallint                 NOT NULL DEFAULT 8,
  "minimum_notice_minutes" integer                  NOT NULL DEFAULT 60,
  "maximum_advance_days"   integer                  NOT NULL DEFAULT 90,
  "updated_at"             timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "booking_settings_duration_window" CHECK ((max_duration_hours >= min_duration_hours)),
  CONSTRAINT "booking_settings_max_duration_hours_check" CHECK (((max_duration_hours >= 1) AND (max_duration_hours <= 24))),
  CONSTRAINT "booking_settings_max_seats_per_booking_check" CHECK (((max_seats_per_booking >= 1) AND (max_seats_per_booking <= 5))),
  CONSTRAINT "booking_settings_maximum_advance_days_check" CHECK (((maximum_advance_days >= 1) AND (maximum_advance_days <= 365))),
  CONSTRAINT "booking_settings_min_duration_hours_check" CHECK (((min_duration_hours >= 1) AND (min_duration_hours <= 24))),
  CONSTRAINT "booking_settings_minimum_notice_minutes_check" CHECK (((minimum_notice_minutes >= 0) AND (minimum_notice_minutes <= 10080))),
  CONSTRAINT "booking_settings_pkey" PRIMARY KEY (singleton),
  CONSTRAINT "booking_settings_singleton_check" CHECK (singleton)
);

ALTER TABLE "public"."booking_settings"
  ENABLE ROW LEVEL SECURITY;

INSERT INTO "public"."booking_settings" ("singleton")
VALUES (true);

CREATE TABLE "public"."business_closures" (
  "id"           bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  "name"         text                     NOT NULL,
  "closure_type" text                     NOT NULL DEFAULT 'temporary'::text,
  "starts_on"    date                     NOT NULL,
  "ends_on"      date                     NOT NULL,
  "note"         text,
  "is_active"    boolean                  NOT NULL DEFAULT true,
  "created_by"   uuid,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "business_closures_closure_type_check" CHECK ((closure_type = ANY (ARRAY['holiday'::text, 'temporary'::text]))),
  CONSTRAINT "business_closures_name_check" CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 120))),
  CONSTRAINT "business_closures_note_check" CHECK (((note IS NULL) OR (char_length(note) <= 500))),
  CONSTRAINT "business_closures_pkey" PRIMARY KEY (id),
  CONSTRAINT "business_closures_valid_window" CHECK ((ends_on >= starts_on))
);

ALTER TABLE "public"."business_closures"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."business_hours" (
  "day_of_week" smallint                 NOT NULL,
  "is_open"     boolean                  NOT NULL DEFAULT true,
  "opens_at"    time without time zone   NOT NULL DEFAULT '08:00:00'::time WITHOUT time zone,
  "closes_at"   time without time zone   NOT NULL DEFAULT '05:00:00'::time WITHOUT time zone,
  "updated_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "business_hours_day_of_week_check" CHECK (((day_of_week >= 0) AND (day_of_week <= 6))),
  CONSTRAINT "business_hours_distinct_times" CHECK (((NOT is_open) OR (opens_at <> closes_at))),
  CONSTRAINT "business_hours_pkey" PRIMARY KEY (day_of_week)
);

ALTER TABLE "public"."business_hours"
  ENABLE ROW LEVEL SECURITY;

INSERT INTO "public"."business_hours" ("day_of_week")
SELECT generate_series(0, 6)::smallint;

CREATE TABLE "public"."package_rate_plans" (
  "id"            bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  "name"          text                     NOT NULL,
  "duration_days" smallint                 NOT NULL,
  "validity_days" smallint                 NOT NULL,
  "price_cents"   bigint                   NOT NULL,
  "is_popular"    boolean                  NOT NULL DEFAULT false,
  "is_active"     boolean                  NOT NULL DEFAULT true,
  "sort_order"    integer                  NOT NULL DEFAULT 0,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "package_rate_plans_check" CHECK (((validity_days >= duration_days) AND (validity_days <= 730))),
  CONSTRAINT "package_rate_plans_duration_days_check" CHECK (((duration_days >= 1) AND (duration_days <= 365))),
  CONSTRAINT "package_rate_plans_name_check" CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 80))),
  CONSTRAINT "package_rate_plans_pkey" PRIMARY KEY (id),
  CONSTRAINT "package_rate_plans_price_cents_check" CHECK ((price_cents >= 0))
);

ALTER TABLE "public"."package_rate_plans"
  ENABLE ROW LEVEL SECURITY;

INSERT INTO "public"."package_rate_plans"
  ("name", "duration_days", "validity_days", "price_cents", "is_popular", "sort_order")
VALUES
  ('3 days', 3, 6, 90000, false, 10),
  ('7 days', 7, 14, 180000, false, 20),
  ('15 days', 15, 30, 300000, false, 30),
  ('30 days', 30, 60, 500000, true, 40);

REVOKE ALL ON SEQUENCE "public"."business_closures_id_seq" FROM "anon";

REVOKE ALL ON SEQUENCE "public"."package_rate_plans_id_seq" FROM "anon";

CREATE OR REPLACE FUNCTION private.audit_cms_change()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_entity_id text := coalesce(
    v_row ->> 'id',
    v_row ->> 'code',
    v_row ->> 'day_of_week',
    v_row ->> 'singleton',
    'settings'
  );
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    v_entity_id,
    jsonb_build_object('source', 'cms')
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

CREATE OR REPLACE FUNCTION private.customer_update_booking (
  p_booking_id   uuid,
  p_booking_date date,
  p_start_time   time without time zone,
  p_seat_codes   text[]
)
  RETURNS public.bookings
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_code text;
  v_seat_count integer;
  v_subtotal bigint;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_booking
  from public.bookings b
  where b.id = p_booking_id and b.user_id = v_actor
  for update;

  if not found then
    raise exception 'Reservation not found' using errcode = 'P0002';
  end if;
  if v_booking.status <> 'confirmed' then
    raise exception 'Only confirmed reservations can be changed' using errcode = 'P0001';
  end if;
  if v_booking.starts_at <= now() + interval '2 hours' then
    raise exception 'Reservations can only be changed at least 2 hours before check-in' using errcode = 'P0001';
  end if;
  if coalesce(cardinality(p_seat_codes), 0) not between 1 and cardinality(v_booking.seat_ids)
     or cardinality(p_seat_codes) <> (select count(distinct value) from unnest(p_seat_codes) as value) then
    raise exception 'Choose between 1 and % unique seats (the number paid for)', cardinality(v_booking.seat_ids)
      using errcode = '22023';
  end if;

  v_starts_at := (p_booking_date::timestamp + p_start_time) at time zone 'Asia/Manila';
  v_ends_at := v_starts_at + make_interval(hours => v_booking.duration_hours);

  for v_code in
    select code
    from (
      select unnest(v_booking.seat_ids) as code
      union
      select unnest(p_seat_codes) as code
    ) affected_seats
    order by code
  loop
    perform pg_advisory_xact_lock(hashtextextended('jit-seat:' || v_code, 0));
  end loop;

  perform 1
  from public.seats s
  where s.code = any(p_seat_codes)
  order by s.code
  for update;

  select count(*), coalesce(sum(s.hourly_rate_cents * v_booking.duration_hours), 0)
  into v_seat_count, v_subtotal
  from public.seats s
  where s.code = any(p_seat_codes)
    and s.is_active
    and s.status <> 'maintenance';

  if v_seat_count <> cardinality(p_seat_codes) then
    raise exception 'One or more seats are unavailable' using errcode = 'P0001';
  end if;
  if p_booking_date = (now() at time zone 'Asia/Manila')::date
     and exists (
       select 1
       from public.walk_in_occupancies occupancy
       join public.seats s on s.id = occupancy.seat_id
       where s.code = any(p_seat_codes)
         and occupancy.ended_at is null
     ) then
    raise exception 'One or more seats are occupied by an active walk-in' using errcode = 'P0001';
  end if;
  if v_subtotal <> v_booking.subtotal_cents then
    raise exception 'Choose seats with the same total price as the paid reservation' using errcode = 'P0001';
  end if;

  delete from public.booking_seats bs where bs.booking_id = v_booking.id;

  begin
    insert into public.booking_seats (booking_id, seat_id, reserved_during)
    select v_booking.id, s.id, tstzrange(v_starts_at, v_ends_at, '[)')
    from public.seats s
    where s.code = any(p_seat_codes);
  exception when exclusion_violation then
    raise exception 'One or more seats were just reserved for that time' using errcode = '23P01';
  end;

  update public.bookings b
  set booking_date = p_booking_date,
      start_time = p_start_time,
      starts_at = v_starts_at,
      ends_at = v_ends_at,
      seat_ids = p_seat_codes,
      confirmation_email_sent_at = null,
      confirmation_email_error = null,
      updated_at = now()
  where b.id = v_booking.id
  returning * into v_booking;

  update public.qr_access_passes q
  set expires_at = v_ends_at + interval '1 hour'
  where q.booking_id = v_booking.id
    and q.revoked_at is null;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (
    v_actor,
    'customer_rescheduled',
    'booking',
    v_booking.id::text,
    jsonb_build_object(
      'reservation_code', v_booking.reservation_code,
      'starts_at', v_starts_at,
      'seat_ids', p_seat_codes
    )
  );

  return v_booking;
end;
$function$;

CREATE OR REPLACE FUNCTION private.validate_booking_business_rules()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_settings public.booking_settings%rowtype;
  v_local_start timestamp;
  v_local_end timestamp;
  v_start_date date;
  v_start_time time;
  v_hours public.business_hours%rowtype;
  v_previous_hours public.business_hours%rowtype;
  v_window_start timestamp;
  v_window_end timestamp;
begin
  if current_setting('jit.seed_mode', true) = 'on' then
    return new;
  end if;

  select * into strict v_settings from public.booking_settings where singleton;

  if new.duration_hours not between v_settings.min_duration_hours and v_settings.max_duration_hours then
    raise exception 'Duration must be between % and % hours',
      v_settings.min_duration_hours, v_settings.max_duration_hours using errcode = '22023';
  end if;
  if coalesce(cardinality(new.seat_ids), 0) not between 1 and v_settings.max_seats_per_booking then
    raise exception 'Choose between 1 and % seats', v_settings.max_seats_per_booking using errcode = '22023';
  end if;
  if new.starts_at < now() + make_interval(mins => v_settings.minimum_notice_minutes) then
    raise exception 'Reservations require at least % minutes notice',
      v_settings.minimum_notice_minutes using errcode = '22023';
  end if;
  if new.booking_date > ((now() at time zone 'Asia/Manila')::date + v_settings.maximum_advance_days) then
    raise exception 'Reservations can only be made up to % days ahead',
      v_settings.maximum_advance_days using errcode = '22023';
  end if;

  v_local_start := new.starts_at at time zone 'Asia/Manila';
  v_local_end := new.ends_at at time zone 'Asia/Manila';
  v_start_date := v_local_start::date;
  v_start_time := v_local_start::time;

  if exists (
    select 1
    from public.business_closures closure
    where closure.is_active
      and daterange(closure.starts_on, closure.ends_on, '[]')
        && daterange(v_local_start::date, (v_local_end - interval '1 microsecond')::date, '[]')
  ) then
    raise exception 'The hub is closed during the selected reservation time' using errcode = 'P0001';
  end if;

  select * into v_hours
  from public.business_hours
  where day_of_week = extract(dow from v_start_date)::smallint;

  if v_hours.is_open and v_hours.opens_at < v_hours.closes_at
     and v_start_time >= v_hours.opens_at and v_start_time < v_hours.closes_at then
    v_window_start := v_start_date + v_hours.opens_at;
    v_window_end := v_start_date + v_hours.closes_at;
  elsif v_hours.is_open and v_hours.opens_at > v_hours.closes_at
        and v_start_time >= v_hours.opens_at then
    v_window_start := v_start_date + v_hours.opens_at;
    v_window_end := (v_start_date + 1) + v_hours.closes_at;
  else
    select * into v_previous_hours
    from public.business_hours
    where day_of_week = extract(dow from (v_start_date - 1))::smallint;

    if v_previous_hours.is_open
       and v_previous_hours.opens_at > v_previous_hours.closes_at
       and v_start_time < v_previous_hours.closes_at then
      v_window_start := (v_start_date - 1) + v_previous_hours.opens_at;
      v_window_end := v_start_date + v_previous_hours.closes_at;
    end if;
  end if;

  if v_window_start is null or v_local_start < v_window_start or v_local_end > v_window_end then
    raise exception 'The reservation must be within configured operating hours' using errcode = '22023';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_seat_type_rate (
  p_seat_type         text,
  p_hourly_rate_cents bigint
)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_updated integer;
begin
  if v_actor is null or not private.has_staff_permission('announcements') then
    raise exception 'Content management access required' using errcode = '42501';
  end if;
  if p_seat_type is null or btrim(p_seat_type) = '' then
    raise exception 'Seat type is required' using errcode = '22023';
  end if;
  if p_hourly_rate_cents is null or p_hourly_rate_cents < 0 then
    raise exception 'Seat rate must be zero or greater' using errcode = '22023';
  end if;

  update public.seats
  set hourly_rate_cents = p_hourly_rate_cents,
      updated_at = now()
  where seat_type = p_seat_type;
  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    raise exception 'Seat type not found' using errcode = 'P0002';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (
    v_actor,
    'update_rate',
    'seat_type',
    p_seat_type,
    jsonb_build_object('hourly_rate_cents', p_hourly_rate_cents, 'seats_updated', v_updated)
  );
  return v_updated;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."update_seat_type_rate"(text, bigint) FROM PUBLIC, "anon", "service_role";

ALTER TABLE "public"."business_closures"
  ADD CONSTRAINT "business_closures_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX business_closures_active_window_idx ON public.business_closures USING btree (starts_on, ends_on)
  WHERE is_active;

CREATE INDEX business_closures_created_by_idx ON public.business_closures USING btree (created_by)
  WHERE (created_by IS NOT NULL);

CREATE INDEX package_rate_plans_active_order_idx ON public.package_rate_plans USING btree (sort_order, duration_days)
  WHERE is_active;

CREATE TRIGGER booking_settings_audit
  AFTER UPDATE ON public.booking_settings
  FOR EACH ROW
  EXECUTE FUNCTION private.audit_cms_change();

CREATE TRIGGER booking_settings_set_updated_at
  BEFORE UPDATE ON public.booking_settings
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER bookings_validate_business_rules
  BEFORE INSERT OR UPDATE OF booking_date, start_time, starts_at, ends_at, duration_hours, seat_ids ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION private.validate_booking_business_rules();

CREATE TRIGGER business_closures_audit
  AFTER INSERT OR DELETE OR UPDATE ON public.business_closures
  FOR EACH ROW
  EXECUTE FUNCTION private.audit_cms_change();

CREATE TRIGGER business_closures_set_updated_at
  BEFORE UPDATE ON public.business_closures
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER business_hours_audit
  AFTER UPDATE ON public.business_hours
  FOR EACH ROW
  EXECUTE FUNCTION private.audit_cms_change();

CREATE TRIGGER business_hours_set_updated_at
  BEFORE UPDATE ON public.business_hours
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER package_rate_plans_audit
  AFTER INSERT OR DELETE OR UPDATE ON public.package_rate_plans
  FOR EACH ROW
  EXECUTE FUNCTION private.audit_cms_change();

CREATE TRIGGER package_rate_plans_set_updated_at
  BEFORE UPDATE ON public.package_rate_plans
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER service_rate_plans_audit
  AFTER INSERT OR DELETE OR UPDATE ON public.service_rate_plans
  FOR EACH ROW
  EXECUTE FUNCTION private.audit_cms_change();

CREATE POLICY "Content staff update booking settings" ON "public"."booking_settings"
  FOR UPDATE
  TO "authenticated"
  USING (( SELECT private.has_staff_permission('announcements'::public.staff_permission) AS has_staff_permission))
  WITH CHECK (( SELECT private.has_staff_permission('announcements'::public.staff_permission) AS has_staff_permission));

CREATE POLICY "Everyone reads booking settings" ON "public"."booking_settings"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

CREATE POLICY "Content staff delete closures" ON "public"."business_closures"
  FOR DELETE
  TO "authenticated"
  USING (( SELECT private.has_staff_permission('announcements'::public.staff_permission) AS has_staff_permission));

CREATE POLICY "Content staff insert closures" ON "public"."business_closures"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (( SELECT private.has_staff_permission('announcements'::public.staff_permission) AS has_staff_permission));

CREATE POLICY "Content staff update closures" ON "public"."business_closures"
  FOR UPDATE
  TO "authenticated"
  USING (( SELECT private.has_staff_permission('announcements'::public.staff_permission) AS has_staff_permission))
  WITH CHECK (( SELECT private.has_staff_permission('announcements'::public.staff_permission) AS has_staff_permission));

CREATE POLICY "Users read active closures; content staff read all" ON "public"."business_closures"
  FOR SELECT
  TO "authenticated"
  USING ((is_active OR ( SELECT private.has_staff_permission('announcements'::public.staff_permission) AS has_staff_permission)));

CREATE POLICY "Visitors read active closures" ON "public"."business_closures"
  FOR SELECT
  TO "anon"
  USING (is_active);

CREATE POLICY "Content staff update business hours" ON "public"."business_hours"
  FOR UPDATE
  TO "authenticated"
  USING (( SELECT private.has_staff_permission('announcements'::public.staff_permission) AS has_staff_permission))
  WITH CHECK (( SELECT private.has_staff_permission('announcements'::public.staff_permission) AS has_staff_permission));

CREATE POLICY "Everyone reads business hours" ON "public"."business_hours"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

CREATE POLICY "Content staff delete package rates" ON "public"."package_rate_plans"
  FOR DELETE
  TO "authenticated"
  USING (( SELECT private.has_staff_permission('announcements'::public.staff_permission) AS has_staff_permission));

CREATE POLICY "Content staff insert package rates" ON "public"."package_rate_plans"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (( SELECT private.has_staff_permission('announcements'::public.staff_permission) AS has_staff_permission));

CREATE POLICY "Content staff update package rates" ON "public"."package_rate_plans"
  FOR UPDATE
  TO "authenticated"
  USING (( SELECT private.has_staff_permission('announcements'::public.staff_permission) AS has_staff_permission))
  WITH CHECK (( SELECT private.has_staff_permission('announcements'::public.staff_permission) AS has_staff_permission));

CREATE POLICY "Users read active package rates; content staff read all" ON "public"."package_rate_plans"
  FOR SELECT
  TO "authenticated"
  USING ((is_active OR ( SELECT private.has_staff_permission('announcements'::public.staff_permission) AS has_staff_permission)));

CREATE POLICY "Visitors read active package rates" ON "public"."package_rate_plans"
  FOR SELECT
  TO "anon"
  USING (is_active);

CREATE POLICY "Content staff delete service rates" ON "public"."service_rate_plans"
  FOR DELETE
  TO "authenticated"
  USING (( SELECT private.has_staff_permission('announcements'::public.staff_permission) AS has_staff_permission));

CREATE POLICY "Content staff insert service rates" ON "public"."service_rate_plans"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (( SELECT private.has_staff_permission('announcements'::public.staff_permission) AS has_staff_permission));

CREATE POLICY "Content staff update service rates" ON "public"."service_rate_plans"
  FOR UPDATE
  TO "authenticated"
  USING (( SELECT private.has_staff_permission('announcements'::public.staff_permission) AS has_staff_permission))
  WITH CHECK (( SELECT private.has_staff_permission('announcements'::public.staff_permission) AS has_staff_permission));

CREATE POLICY "Users read active service rates; staff read all" ON "public"."service_rate_plans"
  FOR SELECT
  TO "authenticated"
  USING
    (((is_active AND (effective_from <= CURRENT_DATE) AND ((effective_until IS NULL) OR (effective_until >= CURRENT_DATE))) OR ( SELECT
    private.has_staff_permission('seating'::public.staff_permission) AS has_staff_permission) OR
    ( SELECT private.has_staff_permission('reservations'::public.staff_permission) AS has_staff_permission) OR
    ( SELECT private.has_staff_permission('announcements'::public.staff_permission) AS has_staff_permission)));

CREATE POLICY "Visitors read active service rates" ON "public"."service_rate_plans"
  FOR SELECT
  TO "anon"
  USING ((is_active AND (effective_from <= CURRENT_DATE) AND ((effective_until IS NULL) OR (effective_until >= CURRENT_DATE))));

COMMENT ON FUNCTION "public"."update_seat_type_rate"(text, bigint) IS 'Updates the reservation hourly rate for every seat in one seat category.';

COMMENT ON TABLE "public"."booking_settings" IS 'Singleton customer booking limits managed through the admin CMS.';

COMMENT ON TABLE "public"."business_closures" IS 'Holiday and temporary full-day closure windows enforced for customer reservations.';

COMMENT ON TABLE "public"."business_hours" IS 'Weekly Manila-time operating hours. Times that close before opening continue into the next calendar day.';

COMMENT ON TABLE "public"."package_rate_plans" IS 'Public multi-day package prices displayed on the customer pricing page.';

REVOKE ALL ON FUNCTION "private"."audit_cms_change"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."validate_booking_business_rules"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."update_seat_type_rate"(text, bigint) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."update_seat_type_rate"(text, bigint) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."update_seat_type_rate"(text, bigint) TO "postgres";

REVOKE ALL ON SEQUENCE "public"."business_closures_id_seq" FROM "authenticated";

GRANT SELECT, USAGE ON SEQUENCE "public"."business_closures_id_seq" TO "authenticated";

REVOKE ALL ON SEQUENCE "public"."business_closures_id_seq" FROM "postgres";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."business_closures_id_seq" TO "postgres";

REVOKE ALL ON SEQUENCE "public"."business_closures_id_seq" FROM "service_role";

GRANT UPDATE ON SEQUENCE "public"."business_closures_id_seq" TO "service_role";

REVOKE ALL ON SEQUENCE "public"."package_rate_plans_id_seq" FROM "authenticated";

GRANT SELECT, USAGE ON SEQUENCE "public"."package_rate_plans_id_seq" TO "authenticated";

REVOKE ALL ON SEQUENCE "public"."package_rate_plans_id_seq" FROM "postgres";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."package_rate_plans_id_seq" TO "postgres";

REVOKE ALL ON SEQUENCE "public"."package_rate_plans_id_seq" FROM "service_role";

GRANT UPDATE ON SEQUENCE "public"."package_rate_plans_id_seq" TO "service_role";

REVOKE ALL ON SEQUENCE "public"."service_rate_plans_id_seq" FROM "authenticated";

GRANT SELECT, USAGE ON SEQUENCE "public"."service_rate_plans_id_seq" TO "authenticated";

REVOKE ALL ON TABLE "public"."booking_settings" FROM "anon";

GRANT SELECT ON TABLE "public"."booking_settings" TO "anon";

REVOKE ALL ON TABLE "public"."booking_settings" FROM "authenticated";

GRANT SELECT, UPDATE ON TABLE "public"."booking_settings" TO "authenticated";

REVOKE ALL ON TABLE "public"."booking_settings" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."booking_settings" TO "postgres";

REVOKE ALL ON TABLE "public"."booking_settings" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."booking_settings" TO "service_role";

REVOKE ALL ON TABLE "public"."business_closures" FROM "anon";

GRANT SELECT ON TABLE "public"."business_closures" TO "anon";

REVOKE ALL ON TABLE "public"."business_closures" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."business_closures" TO "authenticated";

REVOKE ALL ON TABLE "public"."business_closures" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."business_closures" TO "postgres";

REVOKE ALL ON TABLE "public"."business_closures" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."business_closures" TO "service_role";

REVOKE ALL ON TABLE "public"."business_hours" FROM "anon";

GRANT SELECT ON TABLE "public"."business_hours" TO "anon";

REVOKE ALL ON TABLE "public"."business_hours" FROM "authenticated";

GRANT SELECT, UPDATE ON TABLE "public"."business_hours" TO "authenticated";

REVOKE ALL ON TABLE "public"."business_hours" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."business_hours" TO "postgres";

REVOKE ALL ON TABLE "public"."business_hours" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."business_hours" TO "service_role";

REVOKE ALL ON TABLE "public"."package_rate_plans" FROM "anon";

GRANT SELECT ON TABLE "public"."package_rate_plans" TO "anon";

REVOKE ALL ON TABLE "public"."package_rate_plans" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."package_rate_plans" TO "authenticated";

REVOKE ALL ON TABLE "public"."package_rate_plans" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."package_rate_plans" TO "postgres";

REVOKE ALL ON TABLE "public"."package_rate_plans" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."package_rate_plans" TO "service_role";

REVOKE ALL ON TABLE "public"."service_rate_plans" FROM "anon";

GRANT SELECT ON TABLE "public"."service_rate_plans" TO "anon";

REVOKE ALL ON TABLE "public"."service_rate_plans" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."service_rate_plans" TO "authenticated";

