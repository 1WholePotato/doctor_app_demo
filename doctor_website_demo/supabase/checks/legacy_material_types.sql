begin;

insert into public.material_types (id, name, fee)
values ('c0900000-0000-4000-8000-000000000001', 'Electronic', 0),
       ('c0900000-0000-4000-8000-000000000002', 'Hard Copy', 250);

update public.bookings
set material_type_id = 'c0900000-0000-4000-8000-000000000001'
where id = 'c0300000-0000-4000-8000-0000000000c1';

update public.bookings
set material_type_id = 'c0900000-0000-4000-8000-000000000002', material_fee = 250, total_amount = 350
where id = 'c0300000-0000-4000-8000-0000000000c2';

commit;
