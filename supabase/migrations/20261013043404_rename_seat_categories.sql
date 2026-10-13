-- Rename seats in place so booking_seats and walk-in records retain their
-- existing UUID relationships. Bookings also cache the human-readable seat
-- codes, so translate those arrays in the same migration.

create temporary table seat_code_renames (
  old_code text primary key,
  new_code text not null unique,
  category_name text not null,
  seat_type text not null
) on commit drop;

insert into seat_code_renames (old_code, new_code, category_name, seat_type)
values
  ('LA01', 'SO01', 'Solo Learner/Worker', 'solo'),
  ('LA02', 'SO02', 'Solo Learner/Worker', 'solo'),
  ('LA03', 'SO03', 'Solo Learner/Worker', 'solo'),
  ('LA04', 'SO04', 'Solo Learner/Worker', 'solo'),
  ('LA05', 'SO05', 'Solo Learner/Worker', 'solo'),
  ('LA06', 'SO06', 'Solo Learner/Worker', 'solo'),
  ('LA07', 'SO07', 'Solo Learner/Worker', 'solo'),
  ('LA08', 'SO08', 'Solo Learner/Worker', 'solo'),
  ('LB01', 'SO09', 'Solo Learner/Worker', 'solo'),
  ('LB02', 'SO10', 'Solo Learner/Worker', 'solo'),
  ('LB03', 'SO11', 'Solo Learner/Worker', 'solo'),
  ('LB04', 'SO12', 'Solo Learner/Worker', 'solo'),
  ('UA01', 'FD01', 'Floor Desk Setup', 'floor-desk'),
  ('UA02', 'FD02', 'Floor Desk Setup', 'floor-desk'),
  ('UA03', 'FD03', 'Floor Desk Setup', 'floor-desk'),
  ('UA04', 'FD04', 'Floor Desk Setup', 'floor-desk'),
  ('UA05', 'FD05', 'Floor Desk Setup', 'floor-desk'),
  ('UA06', 'FD06', 'Floor Desk Setup', 'floor-desk'),
  ('UA07', 'FD07', 'Floor Desk Setup', 'floor-desk'),
  ('UA08', 'FD08', 'Floor Desk Setup', 'floor-desk'),
  ('UB01', 'FD09', 'Floor Desk Setup', 'floor-desk'),
  ('UB02', 'FD10', 'Floor Desk Setup', 'floor-desk'),
  ('RA01', 'GS01', 'Group Study', 'group-study'),
  ('RA02', 'GS02', 'Group Study', 'group-study'),
  ('RA03', 'GS03', 'Group Study', 'group-study'),
  ('RA04', 'GS04', 'Group Study', 'group-study'),
  ('RB01', 'GS05', 'Group Study', 'group-study'),
  ('RB02', 'GS06', 'Group Study', 'group-study'),
  ('RB03', 'GS07', 'Group Study', 'group-study'),
  ('RB04', 'GS08', 'Group Study', 'group-study'),
  ('RC01', 'GS09', 'Group Study', 'group-study'),
  ('RC02', 'GS10', 'Group Study', 'group-study'),
  ('RC03', 'GS11', 'Group Study', 'group-study'),
  ('RC04', 'GS12', 'Group Study', 'group-study'),
  ('LW01', 'HC01', 'High Chair', 'high-chair'),
  ('LW02', 'HC02', 'High Chair', 'high-chair'),
  ('LW03', 'HC03', 'High Chair', 'high-chair'),
  ('LW04', 'HC04', 'High Chair', 'high-chair'),
  ('BR01', 'HC05', 'High Chair', 'high-chair'),
  ('BR02', 'HC06', 'High Chair', 'high-chair'),
  ('BR03', 'HC07', 'High Chair', 'high-chair'),
  ('BR04', 'HC08', 'High Chair', 'high-chair'),
  ('BR05', 'HC09', 'High Chair', 'high-chair'),
  ('BR06', 'HC10', 'High Chair', 'high-chair'),
  ('BR07', 'HC11', 'High Chair', 'high-chair'),
  ('BR08', 'HC12', 'High Chair', 'high-chair'),
  ('RW01', 'HC13', 'High Chair', 'high-chair'),
  ('RW02', 'HC14', 'High Chair', 'high-chair'),
  ('RW03', 'HC15', 'High Chair', 'high-chair'),
  ('RW04', 'HC16', 'High Chair', 'high-chair');

do $$
begin
  if (select count(*) from seat_code_renames) <> 50 then
    raise exception 'Expected exactly 50 seat-code mappings';
  end if;

  if (
    select count(*)
    from public.seats as seat
    join seat_code_renames as rename on rename.old_code = seat.code
  ) <> 50 then
    raise exception 'Expected all 50 legacy seat codes before renaming';
  end if;
end;
$$;

update public.bookings as booking
set seat_ids = (
  select array_agg(coalesce(rename.new_code, code.value) order by code.position) as seat_ids
  from unnest(booking.seat_ids) with ordinality as code(value, position)
  left join seat_code_renames as rename on rename.old_code = code.value
)
where booking.seat_ids && array(select old_code from seat_code_renames);

update public.audit_logs as audit
set entity_id = rename.new_code
from seat_code_renames as rename
where audit.entity_type = 'seat'
  and audit.entity_id = rename.old_code;

update public.audit_logs as audit
set details = jsonb_set(audit.details, '{seat_code}', to_jsonb(rename.new_code), false)
from seat_code_renames as rename
where audit.details ->> 'seat_code' = rename.old_code;

update public.seats as seat
set code = rename.new_code,
    name = rename.category_name || ' ' || rename.new_code,
    zone = rename.category_name,
    seat_type = rename.seat_type
from seat_code_renames as rename
where seat.code = rename.old_code;

do $$
begin
  if (
    select count(*)
    from public.seats
    where code ~ '^(SO(0[1-9]|1[0-2])|FD(0[1-9]|10)|GS(0[1-9]|1[0-2])|HC(0[1-9]|1[0-6]))$'
  ) <> 50 then
    raise exception 'Seat-category rename did not produce all 50 expected codes';
  end if;

  if exists (
    select 1
    from public.bookings as booking,
         unnest(booking.seat_ids) as codes(code)
    join seat_code_renames as rename on rename.old_code = codes.code
  ) then
    raise exception 'A booking still contains a legacy seat code';
  end if;
end;
$$;
