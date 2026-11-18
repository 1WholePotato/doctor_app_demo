begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(41);

select ok((select relrowsecurity from pg_class where oid = 'public.bookings'::regclass), 'bookings have row level security');
select ok((select relrowsecurity from pg_class where oid = 'public.payments'::regclass), 'payments have row level security');

insert into public.courses (id, course_title, course_description, course_price, active)
values ('b1300000-0000-4000-8000-000000000001', 'Fixture Retired Course', 'No longer offered.', 100.00, false);
insert into public.course_sessions (id, course_id, location_id, start_date, end_date, start_time, end_time, max_students)
values ('b1300000-0000-4000-8000-000000000011', 'b0100000-0000-4000-8000-000000000023', 'b0100000-0000-4000-8000-000000000022',
        current_date, current_date, '09:00', '12:00', 5),
       ('b1300000-0000-4000-8000-000000000012', 'b0100000-0000-4000-8000-000000000023', 'b0100000-0000-4000-8000-000000000022',
        current_date + 10, current_date + 10, '09:00', '12:00', 1),
       ('b1300000-0000-4000-8000-000000000013', 'b1300000-0000-4000-8000-000000000001', 'b0100000-0000-4000-8000-000000000022',
        current_date + 10, current_date + 10, '09:00', '12:00', 5),
       ('b1300000-0000-4000-8000-000000000014', 'b0100000-0000-4000-8000-000000000023', 'b0100000-0000-4000-8000-000000000022',
        current_date - 1, current_date - 1, '09:00', '12:00', 5);
insert into public.bookings (id, user_id, course_session_id, material_type_id, booking_status)
values ('b1300000-0000-4000-8000-000000000021', 'b0100000-0000-4000-8000-000000000014', 'b1300000-0000-4000-8000-000000000012',
        'b0100000-0000-4000-8000-000000000033', 'Confirmed');

select results_eq(
  $$select id, public.bookable(cs) from public.course_sessions cs
    where id in ('b0100000-0000-4000-8000-000000000025', 'b0100000-0000-4000-8000-000000000053', 'b1300000-0000-4000-8000-000000000011',
                 'b1300000-0000-4000-8000-000000000012', 'b1300000-0000-4000-8000-000000000013', 'b1300000-0000-4000-8000-000000000014')
    order by id$$,
  $$values ('b0100000-0000-4000-8000-000000000025'::uuid, true), ('b0100000-0000-4000-8000-000000000053'::uuid, false),
           ('b1300000-0000-4000-8000-000000000011'::uuid, true), ('b1300000-0000-4000-8000-000000000012'::uuid, false),
           ('b1300000-0000-4000-8000-000000000013'::uuid, false), ('b1300000-0000-4000-8000-000000000014'::uuid, false)$$,
  'an open class and one starting today are bookable; cancelled, full, retired-course and started classes are not');

set local role anon;
select throws_ok('select * from public.bookings', '42501', null, 'anon cannot read bookings');
select throws_ok('select * from public.payments', '42501', null, 'anon cannot read payments');
select throws_ok(
  $$insert into public.bookings (user_id, course_session_id, material_type_id)
    values ('b0100000-0000-4000-8000-000000000012', 'b0100000-0000-4000-8000-000000000025', 'b0100000-0000-4000-8000-000000000033')$$,
  '42501', null, 'anon cannot create bookings');
select throws_ok($$select public.bookable(cs) from public.course_sessions cs$$, '42501', null, 'anon cannot ask whether a class is bookable');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0100000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select results_eq(
  $$select id from public.bookings order by id$$,
  $$values ('b0100000-0000-4000-8000-000000000034'::uuid), ('b0100000-0000-4000-8000-000000000037'::uuid),
           ('b0100000-0000-4000-8000-000000000054'::uuid), ('b0100000-0000-4000-8000-000000000072'::uuid),
           ('b0100000-0000-4000-8000-000000000091'::uuid)$$,
  'student A reads every booking of their own and nothing else');
select results_eq(
  $$select id from public.payments order by id$$,
  $$values ('b0100000-0000-4000-8000-000000000035'::uuid), ('b0100000-0000-4000-8000-000000000038'::uuid),
           ('b0100000-0000-4000-8000-000000000055'::uuid)$$,
  'student A reads the payments on their own bookings');
select results_eq(
  $$select id from public.bookings where course_session_id = 'b0100000-0000-4000-8000-000000000073' order by id$$,
  $$values ('b0100000-0000-4000-8000-000000000072'::uuid), ('b0100000-0000-4000-8000-000000000091'::uuid)$$,
  'student A sees their own bookings in class 73, not student B''s held seat');
select is(
  (select public.seats_taken(cs) from public.course_sessions cs where id = 'b0100000-0000-4000-8000-000000000073'),
  1, 'seat counts still include other students'' bookings');
select is(
  (select public.bookable(cs) from public.course_sessions cs where id = 'b1300000-0000-4000-8000-000000000012'),
  false, 'a class filled by another student reads as not bookable to student A');
select throws_ok(
  $$insert into public.bookings (user_id, course_session_id, material_type_id)
    values ('b0100000-0000-4000-8000-000000000014', 'b0100000-0000-4000-8000-000000000025', 'b0100000-0000-4000-8000-000000000033')$$,
  '42501', null, 'student A cannot create a booking for student B');
select is_empty(
  $$update public.bookings set booking_status = 'Cancelled' where id = 'b0100000-0000-4000-8000-000000000071' returning id$$,
  'student A cannot change student B''s booking');
select throws_ok(
  $$update public.bookings set user_id = 'b0100000-0000-4000-8000-000000000014' where id = 'b0100000-0000-4000-8000-000000000072'$$,
  '42501', null, 'student A cannot hand their booking to student B');
select throws_ok($$delete from public.bookings where id = 'b0100000-0000-4000-8000-000000000072'$$, '42501', null,
  'student A cannot delete a booking');
select throws_ok(
  $$insert into public.payments (booking_id, amount, payment_status_id)
    select 'b0100000-0000-4000-8000-000000000072', 100, id from public.payment_statuses where name = 'Paid'$$,
  '42501', null, 'student A cannot record a payment');
select throws_ok($$update public.payments set amount = 0$$, '42501', null, 'student A cannot change a payment');
select throws_ok($$delete from public.payments$$, '42501', null, 'student A cannot delete a payment');

select lives_ok(
  $$select public.reserve_seat('b1300000-0000-4000-8000-000000000011', 'b0100000-0000-4000-8000-000000000033')$$,
  'student A books a class starting today, as bookable said');
select throws_ok(
  $$select public.reserve_seat('b1300000-0000-4000-8000-000000000012', 'b0100000-0000-4000-8000-000000000033')$$,
  '23514', null, 'reserve_seat refuses the full class bookable rejected');
select throws_ok(
  $$select public.reserve_seat('b1300000-0000-4000-8000-000000000013', 'b0100000-0000-4000-8000-000000000033')$$,
  '23514', null, 'reserve_seat refuses the retired course bookable rejected');
select throws_ok(
  $$select public.reserve_seat('b1300000-0000-4000-8000-000000000014', 'b0100000-0000-4000-8000-000000000033')$$,
  '23514', null, 'reserve_seat refuses the started class bookable rejected');
select throws_ok(
  $$select public.reserve_seat('b0100000-0000-4000-8000-000000000053', 'b0100000-0000-4000-8000-000000000033')$$,
  '23514', null, 'reserve_seat refuses the cancelled class bookable rejected');
select is(
  (select count(*)::int from public.bookings where course_session_id = 'b1300000-0000-4000-8000-000000000011' and booking_status = 'Pending'),
  1, 'the booking reserve_seat made is in student A''s own history');

select set_config('request.jwt.claims', '{"sub":"b0100000-0000-4000-8000-000000000014","role":"authenticated"}', true);
select results_eq(
  $$select id from public.bookings order by id$$,
  $$values ('b0100000-0000-4000-8000-000000000071'::uuid), ('b1300000-0000-4000-8000-000000000021'::uuid)$$,
  'student B reads only their own bookings');
select is_empty('select id from public.payments', 'student B reads none of student A''s payments');
select is(
  (select count(*)::int from public.payment_attempts where booking_id = 'b0100000-0000-4000-8000-000000000071'),
  1, 'student B still reads the payment attempts on their own booking');
select lives_ok(
  $$update public.bookings set material_type_id = material_type_id where id = 'b0100000-0000-4000-8000-000000000071'$$,
  'student B can still write their own booking, as the booking triggers allow');

select set_config('request.jwt.claims', '{"sub":"b0100000-0000-4000-8000-000000000013","role":"authenticated"}', true);
select results_eq(
  $$select id from public.bookings order by id$$,
  $$values ('b0100000-0000-4000-8000-000000000034'::uuid), ('b0100000-0000-4000-8000-000000000037'::uuid)$$,
  'the instructor reads the bookings of the class they teach and no other');
select is_empty('select id from public.payments', 'the instructor reads no payments');
select is_empty(
  $$update public.bookings set booking_status = 'Cancelled' where id = 'b0100000-0000-4000-8000-000000000034' returning id$$,
  'the instructor cannot change a booking in their class');
select throws_ok(
  $$insert into public.bookings (user_id, course_session_id, material_type_id)
    values ('b0100000-0000-4000-8000-000000000012', 'b0100000-0000-4000-8000-000000000025', 'b0100000-0000-4000-8000-000000000033')$$,
  '42501', null, 'the instructor cannot book for a student');
reset role;

update public.instructors set active = false where id = 'b0100000-0000-4000-8000-000000000021';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0100000-0000-4000-8000-000000000013","role":"authenticated"}', true);
select is_empty('select id from public.bookings', 'a deactivated instructor reads no bookings');
reset role;
update public.instructors set active = true where id = 'b0100000-0000-4000-8000-000000000021';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0100000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select is((select count(*)::int from public.bookings), 8, 'the admin reads every student''s bookings');
select is((select count(*)::int from public.payments), 3, 'the admin reads every payment');
select is(
  (select count(*)::int from public.payments p join public.payment_statuses ps on ps.id = p.payment_status_id where ps.name = 'Paid'),
  2, 'the admin dashboard''s paid-payment read still sees both paid payments');
select lives_ok(
  $$update public.bookings set booking_status = 'Cancelled' where id = 'b1300000-0000-4000-8000-000000000021'$$,
  'the admin can still change a booking');
select throws_ok(
  $$insert into public.payments (booking_id, amount, payment_status_id)
    select 'b0100000-0000-4000-8000-000000000072', 100, id from public.payment_statuses where name = 'Paid'$$,
  '42501', null, 'the admin cannot record a payment through the API either');
reset role;

set local role service_role;
select is((select count(*)::int from public.bookings), 8, 'the service role reads every booking');
select is((select count(*)::int from public.payments), 3, 'the service role reads every payment');
reset role;

select * from finish();
rollback;
