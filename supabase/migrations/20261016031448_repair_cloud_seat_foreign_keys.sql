-- The initial local-to-cloud data copy preserved the local seat UUIDs in
-- booking_seats and walk_in_occupancies while the hosted migration created a
-- fresh set of seat UUIDs. Recover those relationships through the stable,
-- unique seat code. This is a no-op when the IDs already match (for example on
-- a normal local reset).
create temporary table seat_id_repair_source (
  old_id uuid primary key,
  code text not null unique
) on commit drop;

insert into seat_id_repair_source (old_id, code) values
  ('2b11504b-bddd-4189-a79e-c8a1306dd465', 'FD01'),
  ('c41d079d-e349-4b31-90c3-d54c7bac1dce', 'FD02'),
  ('d823b246-7297-4711-a074-0d34929193d3', 'FD03'),
  ('33d7be24-be69-446a-8974-0a697c5360e8', 'FD04'),
  ('7b24df61-b7b0-4c37-a791-6334bbd10d66', 'FD05'),
  ('6ce84497-306a-49c4-ae7a-1142bad3c6c6', 'FD06'),
  ('73081acd-5f89-48bc-8c9a-71d4a721c161', 'FD07'),
  ('c7ed2834-7a35-4e3f-8d7f-22d7c7c4138f', 'FD08'),
  ('49c2df26-d6b3-4b0b-91a0-43f862b68850', 'FD09'),
  ('309a2c2a-62f9-4279-b5a7-d633166bf9ad', 'FD10'),
  ('734cbec6-4947-4dae-8f07-7eac027a38d0', 'GS01'),
  ('cd88170e-bbcb-4c8e-86a7-930c90c8729e', 'GS02'),
  ('d66ed48a-7294-493a-a426-297f1b560bff', 'GS03'),
  ('ffe80735-c7e3-4389-8b29-6df97b8526d8', 'GS04'),
  ('074a95b1-9d4e-4ddf-a5fe-76d50c063126', 'GS05'),
  ('0b5cc00f-f1ff-4de1-be48-af7f3b16333f', 'GS06'),
  ('4bba11ed-2cfa-47f8-8b80-b4018944adae', 'GS07'),
  ('171ee15e-2ec2-43d8-b95e-6115e0cd2809', 'GS08'),
  ('4914500e-5f7d-4040-8879-bbc3b10b014b', 'GS09'),
  ('101ec1e7-b3f1-4d37-b967-f96738341d2b', 'GS10'),
  ('8aa13c8b-6477-4b16-a7c5-1eb7968c9394', 'GS11'),
  ('fabff218-0823-49c7-b0bb-ad3b8d98633d', 'GS12'),
  ('ea27ab8e-74a9-43ed-aaa2-b264198b0883', 'HC01'),
  ('a6df31a3-173a-4133-a225-2c2a7f05a108', 'HC02'),
  ('7cdf3c2d-8365-4314-8c9a-6ba2deb9fa5d', 'HC03'),
  ('4b2cf959-9c38-493c-ae70-6d457b87c5c2', 'HC04'),
  ('732f52d8-7c82-429d-96a5-1d7d85cf0cc7', 'HC05'),
  ('11a4043b-e44f-46c0-98c2-87e104db9a4d', 'HC06'),
  ('e6195ee0-8761-47f3-b8e1-ea7b1b850c99', 'HC07'),
  ('86efbcb2-770b-4f77-9a2f-95f5363ab6e2', 'HC08'),
  ('ed4cca55-e273-4054-b6da-4e10ee50c4f8', 'HC09'),
  ('667a8442-6422-45bc-a3d7-bc427c872c8f', 'HC10'),
  ('b8af09b6-07de-4ea4-a73d-ced73bb3d157', 'HC11'),
  ('23400460-5607-469a-b9d4-3915399b9a4c', 'HC12'),
  ('44d1068e-92c7-4131-a371-a041779cea1a', 'HC13'),
  ('d08ab4a2-ecba-4a30-983c-c8d6e28b4cc6', 'HC14'),
  ('080de230-7a43-4ba4-b8b9-fc7d199c5a14', 'HC15'),
  ('bd70b154-e71c-4159-881c-cce29db61e3b', 'HC16'),
  ('ff14f07e-01db-4546-8c6c-f0a9bde27436', 'SO01'),
  ('e6661ab4-5945-466c-9ef3-c4e4e4777e95', 'SO02'),
  ('22139c00-352f-44d9-9925-37717e7bc4f9', 'SO03'),
  ('c2205560-0bc8-4057-aa54-43870f369493', 'SO04'),
  ('bce656aa-d5ca-4103-92fe-dce7bd839cbc', 'SO05'),
  ('95ec3a13-8ded-4bbb-bbe8-dc43ccf5cee6', 'SO06'),
  ('c3200343-00af-4423-98e6-9d1b470bd3d8', 'SO07'),
  ('aa0c6a19-313d-48b5-acf0-8d028d727c73', 'SO08'),
  ('2b6150c5-261e-43ab-909c-e8a3bda3c866', 'SO09'),
  ('13bac363-8387-4050-a7bf-b1b8ff4b7f58', 'SO10'),
  ('06c9edf7-21ee-4606-bacd-9010b6174242', 'SO11'),
  ('ebd4a4ce-b98b-4f8d-b875-4adaf23938d0', 'SO12');

-- A partially repaired database may already contain the target relationship.
-- Remove only the stale duplicate before remapping the remaining row.
delete from public.booking_seats stale
using seat_id_repair_source source_seat, public.seats target_seat
where stale.seat_id = source_seat.old_id
  and target_seat.code = source_seat.code
  and stale.seat_id <> target_seat.id
  and exists (
    select 1
    from public.booking_seats current_link
    where current_link.booking_id = stale.booking_id
      and current_link.seat_id = target_seat.id
  );

update public.booking_seats booking_seat
set seat_id = target_seat.id
from seat_id_repair_source source_seat
join public.seats target_seat on target_seat.code = source_seat.code
where booking_seat.seat_id = source_seat.old_id
  and booking_seat.seat_id <> target_seat.id;

update public.walk_in_occupancies occupancy
set seat_id = target_seat.id,
    updated_at = now()
from seat_id_repair_source source_seat
join public.seats target_seat on target_seat.code = source_seat.code
where occupancy.seat_id = source_seat.old_id
  and occupancy.seat_id <> target_seat.id;

do $$
begin
  if exists (
    select 1
    from public.booking_seats booking_seat
    left join public.seats seat on seat.id = booking_seat.seat_id
    where seat.id is null
  ) then
    raise exception 'Cloud booking-seat repair left unresolved seat IDs';
  end if;

  if exists (
    select 1
    from public.walk_in_occupancies occupancy
    left join public.seats seat on seat.id = occupancy.seat_id
    where seat.id is null
  ) then
    raise exception 'Cloud walk-in repair left unresolved seat IDs';
  end if;
end;
$$;
