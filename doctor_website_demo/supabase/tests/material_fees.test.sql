begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(32);

select col_not_null('public', 'courses', 'printed_material_fee', 'every course has a printed material fee');
select col_not_null('public', 'material_types', 'kind', 'every material type is electronic or printed');
select col_not_null('public', 'bookings', 'course_price', 'every booking keeps the course price it was sold at');

select results_eq(
  $$select name, kind, fee from public.material_types where active order by kind$$,
  $$values ('Electronic', 'electronic', 0.00::numeric), ('Printed', 'printed', 0.00::numeric)$$,
  'the seed offers one electronic and one printed material type');
select throws_ok(
  $$insert into public.material_types (name, kind, fee) values ('Electronic plus', 'electronic', 10)$$,
  '23514', null, 'an electronic material type cannot carry a fee');
select throws_ok(
  $$insert into public.material_types (name, kind) values ('Audio', 'audio')$$,
  '23514', null, 'a material type is electronic or printed');
select throws_ok(
  $$update public.courses set printed_material_fee = -1 where id = 'b0100000-0000-4000-8000-000000000023'$$,
  '23514', null, 'a printed material fee cannot be negative');

insert into auth.users (instance_id, id, aud, role, email)
values ('00000000-0000-0000-0000-000000000000', 'b0900000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'b09-student@example.test');
insert into public.users (id, role_id, first_name, last_name, birth_date, passport_num, cell_num, email, sanc_num)
values ('b0900000-0000-4000-8000-000000000001', '4fd9e72e-f94b-4222-b5c1-95b447088d4d', 'Material', 'Student', '1990-01-01', 'B09-1', '0000000901', 'b09-student@example.test', 'B09-1');

insert into public.courses (id, course_title, course_description, course_price, printed_material_fee)
values ('b0900000-0000-4000-8000-000000000010', 'Fixture Wound Care', 'Second course with its own printed fee.', 300.00, 80.00);
insert into public.course_sessions (id, course_id, location_id, start_date, end_date, start_time, end_time, max_students)
values ('b0900000-0000-4000-8000-000000000011', 'b0900000-0000-4000-8000-000000000010', 'b0100000-0000-4000-8000-000000000022',
        current_date + 60, current_date + 60, '09:00', '12:00', 10);

select results_eq(
  $$select id, printed_material_fee from public.courses
    where id in ('b0100000-0000-4000-8000-000000000023', 'b0900000-0000-4000-8000-000000000010') order by course_price$$,
  $$values ('b0100000-0000-4000-8000-000000000023'::uuid, 150.00::numeric), ('b0900000-0000-4000-8000-000000000010'::uuid, 80.00::numeric)$$,
  'each course sets its own printed material fee');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0900000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.bookings (id, user_id, course_session_id, material_type_id, course_price, material_fee, total_amount)
    values ('b0900000-0000-4000-8000-000000000021', 'b0900000-0000-4000-8000-000000000001', 'b0100000-0000-4000-8000-000000000025',
            'b0100000-0000-4000-8000-000000000033', 1, 999, 1)$$,
  'a student books electronic material while sending made-up prices');
select lives_ok(
  $$insert into public.bookings (id, user_id, course_session_id, material_type_id, course_price, material_fee, total_amount)
    values ('b0900000-0000-4000-8000-000000000022', 'b0900000-0000-4000-8000-000000000001', 'b0100000-0000-4000-8000-000000000052',
            'b0100000-0000-4000-8000-000000000061', 0, 0, 0)$$,
  'a student books printed material while sending zero prices');
select lives_ok(
  $$insert into public.bookings (id, user_id, course_session_id, material_type_id, total_amount)
    values ('b0900000-0000-4000-8000-000000000023', 'b0900000-0000-4000-8000-000000000001', 'b0900000-0000-4000-8000-000000000011',
            'b0100000-0000-4000-8000-000000000061', 5)$$,
  'a student books printed material on a second course');

select results_eq(
  $$select id, course_price, material_fee, total_amount from public.bookings
    where user_id = 'b0900000-0000-4000-8000-000000000001' order by id$$,
  $$values ('b0900000-0000-4000-8000-000000000021'::uuid, 100.00::numeric, 0.00::numeric, 100.00::numeric),
           ('b0900000-0000-4000-8000-000000000022'::uuid, 100.00::numeric, 150.00::numeric, 250.00::numeric),
           ('b0900000-0000-4000-8000-000000000023'::uuid, 300.00::numeric, 80.00::numeric, 380.00::numeric)$$,
  'the database prices each booking from its course and material, ignoring client amounts');

select throws_ok(
  $$insert into public.bookings (user_id, course_session_id, total_amount)
    values ('b0900000-0000-4000-8000-000000000001', 'b0100000-0000-4000-8000-000000000052', 100)$$,
  '23502', null, 'a booking must choose a material type');

select throws_ok(
  $$update public.bookings set total_amount = 1 where id = 'b0900000-0000-4000-8000-000000000022'$$,
  '42501', null, 'a student cannot change a booking total');
select throws_ok(
  $$update public.bookings set material_fee = 0, total_amount = 100 where id = 'b0900000-0000-4000-8000-000000000022'$$,
  '42501', null, 'a student cannot change a booking material fee');
select throws_ok(
  $$update public.bookings set course_price = 1 where id = 'b0900000-0000-4000-8000-000000000022'$$,
  '42501', null, 'a student cannot change a booking course price');
select throws_ok(
  $$update public.bookings set material_type_id = 'b0100000-0000-4000-8000-000000000033' where id = 'b0900000-0000-4000-8000-000000000022'$$,
  '42501', null, 'a student cannot switch material on an existing booking');
select lives_ok(
  $$update public.bookings set total_amount = 250, booking_status = 'Cancelled' where id = 'b0900000-0000-4000-8000-000000000022'$$,
  'rewriting a snapshot column with its stored value is not a change');

set local role anon;
select throws_ok(
  $$update public.bookings set total_amount = 0 where id = 'b0900000-0000-4000-8000-000000000021'$$,
  '42501', null, 'an anonymous caller cannot change a booking total');
reset role;

update public.material_types set active = false where id = 'b0100000-0000-4000-8000-000000000061';
select throws_ok(
  $$insert into public.bookings (user_id, course_session_id, material_type_id)
    values ('b0900000-0000-4000-8000-000000000001', 'b0900000-0000-4000-8000-000000000011', 'b0100000-0000-4000-8000-000000000061')$$,
  '23514', null, 'an inactive material type cannot be booked');
update public.material_types set active = true where id = 'b0100000-0000-4000-8000-000000000061';

select throws_ok(
  $$insert into public.bookings (user_id, course_session_id, material_type_id)
    values ('b0900000-0000-4000-8000-000000000001', 'b0900000-0000-4000-8000-0000000000ff', 'b0100000-0000-4000-8000-000000000033')$$,
  '23503', null, 'a booking for an unknown class is refused');

update public.courses set course_price = 999, printed_material_fee = 444 where id = 'b0100000-0000-4000-8000-000000000023';
update public.courses set course_price = 333 where id = 'b0900000-0000-4000-8000-000000000010';
update public.material_types set fee = 777 where id = 'b0100000-0000-4000-8000-000000000061';

select results_eq(
  $$select id, course_price, material_fee, total_amount from public.bookings
    where user_id = 'b0900000-0000-4000-8000-000000000001' order by id$$,
  $$values ('b0900000-0000-4000-8000-000000000021'::uuid, 100.00::numeric, 0.00::numeric, 100.00::numeric),
           ('b0900000-0000-4000-8000-000000000022'::uuid, 100.00::numeric, 150.00::numeric, 250.00::numeric),
           ('b0900000-0000-4000-8000-000000000023'::uuid, 300.00::numeric, 80.00::numeric, 380.00::numeric)$$,
  'course price, printed fee and material type fee edits leave existing bookings alone');
select results_eq(
  $$select total_amount from public.bookings where id = 'b0100000-0000-4000-8000-000000000034'$$,
  $$values (100.00::numeric)$$,
  'the seeded booking keeps its amount after the edits');

insert into public.bookings (id, user_id, course_session_id, material_type_id, booking_status)
values ('b0900000-0000-4000-8000-000000000024', 'b0900000-0000-4000-8000-000000000001', 'b0100000-0000-4000-8000-000000000052',
        'b0100000-0000-4000-8000-000000000061', 'Pending');
select results_eq(
  $$select course_price, material_fee, total_amount from public.bookings where id = 'b0900000-0000-4000-8000-000000000024'$$,
  $$values (999.00::numeric, 444.00::numeric, 1443.00::numeric)$$,
  'a new booking takes the edited course price and printed fee, not the material type list fee');

select throws_ok(
  $$update public.bookings set total_amount = 1 where id = 'b0900000-0000-4000-8000-000000000024'$$,
  '23514', null, 'even a privileged writer keeps the total equal to course price plus material fee');
select lives_ok(
  $$update public.bookings set material_fee = 0, total_amount = 999 where id = 'b0900000-0000-4000-8000-000000000024'$$,
  'a privileged writer can correct a snapshot when the total still adds up');

select is(
  (select count(*)::integer from public.bookings
   where total_amount <> course_price + material_fee),
  0, 'every booking total equals its course price plus material fee');

select results_eq(
  $$select name, material_fee, total_amount from public.course_material_prices('b0900000-0000-4000-8000-000000000010')$$,
  $$values ('Electronic', 0.00::numeric, 333.00::numeric), ('Printed', 80.00::numeric, 413.00::numeric)$$,
  'course_material_prices quotes what a new booking on that course would store');

set local role authenticated;
select lives_ok(
  $$select * from public.course_material_prices('b0100000-0000-4000-8000-000000000023')$$,
  'a signed-in student can read material prices for a course');
set local role anon;
select throws_ok(
  $$select * from public.course_material_prices('b0100000-0000-4000-8000-000000000023')$$,
  '42501', null, 'an anonymous caller cannot read material prices');
reset role;

select has_function('public', 'price_booking', 'bookings are priced by a database trigger');
select function_privs_are('public', 'price_booking', array[]::text[], 'authenticated', array[]::text[],
  'students cannot call the pricing trigger function directly');

select * from finish();
rollback;
