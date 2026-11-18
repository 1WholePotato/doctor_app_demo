begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(44);

insert into auth.users (instance_id, id, aud, role, email)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email
from (values
  ('b1000000-0000-4000-8000-000000000001'::uuid, 'b10-first@example.test'),
  ('b1000000-0000-4000-8000-000000000002'::uuid, 'b10-second@example.test'),
  ('b1000000-0000-4000-8000-000000000003'::uuid, 'b10-third@example.test'),
  ('b1000000-0000-4000-8000-000000000004'::uuid, 'b10-inactive@example.test')
) as fixture(id, email);
insert into public.users (id, role_id, first_name, last_name, birth_date, passport_num, cell_num, email, sanc_num, active)
select id, '4fd9e72e-f94b-4222-b5c1-95b447088d4d', 'Seat', persona, '1990-01-01', 'B10-' || persona, '00000010' || right(id::text, 2), email, 'B10-' || persona, active
from (values
  ('b1000000-0000-4000-8000-000000000001'::uuid, 'First', 'b10-first@example.test', true),
  ('b1000000-0000-4000-8000-000000000002'::uuid, 'Second', 'b10-second@example.test', true),
  ('b1000000-0000-4000-8000-000000000003'::uuid, 'Third', 'b10-third@example.test', true),
  ('b1000000-0000-4000-8000-000000000004'::uuid, 'Inactive', 'b10-inactive@example.test', false)
) as fixture(id, persona, email, active);

insert into public.courses (id, course_title, course_description, course_price, printed_material_fee, active)
values ('b1000000-0000-4000-8000-000000000020', 'Fixture Hidden Course', 'Not open for booking.', 200.00, 50.00, false);

insert into public.course_sessions (id, course_id, location_id, start_date, end_date, start_time, end_time, max_students)
values ('b1000000-0000-4000-8000-000000000011', 'b0100000-0000-4000-8000-000000000023', 'b0100000-0000-4000-8000-000000000022',
        current_date + 40, current_date + 40, '09:00', '12:00', 2),
       ('b1000000-0000-4000-8000-000000000012', 'b0100000-0000-4000-8000-000000000023', 'b0100000-0000-4000-8000-000000000022',
        current_date - 1, current_date - 1, '09:00', '12:00', 10),
       ('b1000000-0000-4000-8000-000000000013', 'b1000000-0000-4000-8000-000000000020', 'b0100000-0000-4000-8000-000000000022',
        current_date + 40, current_date + 40, '09:00', '12:00', 10),
       ('b1000000-0000-4000-8000-000000000014', 'b0100000-0000-4000-8000-000000000023', 'b0100000-0000-4000-8000-000000000022',
        current_date, current_date, '18:00', '20:00', 10),
       ('b1000000-0000-4000-8000-000000000015', 'b0100000-0000-4000-8000-000000000023', 'b0100000-0000-4000-8000-000000000022',
        current_date + 41, current_date + 41, '09:00', '12:00', 1);

create temporary table reserved (label text primary key, booking public.bookings) on commit drop;
grant all on reserved to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$insert into reserved select 'first', public.reserve_seat('b1000000-0000-4000-8000-000000000011', 'b0100000-0000-4000-8000-000000000061')$$,
  'a student reserves a seat with printed material');
select results_eq(
  $$select (booking).user_id, (booking).booking_status, (booking).course_price, (booking).material_fee, (booking).total_amount, (booking).expires_at
    from reserved where label = 'first'$$,
  $$values ('b1000000-0000-4000-8000-000000000001'::uuid, 'Pending', 100.00::numeric, 150.00::numeric, 250.00::numeric, now() + interval '72 hours')$$,
  'the reservation is a pending booking at the trusted price, held for 72 hours');
select lives_ok(
  $$insert into reserved select 'first again', public.reserve_seat('b1000000-0000-4000-8000-000000000011', 'b0100000-0000-4000-8000-000000000061')$$,
  'the same student submits the same reservation again');
select lives_ok(
  $$insert into reserved select 'first electronic', public.reserve_seat('b1000000-0000-4000-8000-000000000011', 'b0100000-0000-4000-8000-000000000033')$$,
  'the same student submits again with a different material');
select results_eq(
  $$select count(distinct (booking).id)::int, min((booking).material_fee) from reserved where label like 'first%'$$,
  $$values (1, 150.00::numeric)$$,
  'repeat submissions return the existing booking unchanged');
select is(
  (select count(*)::int from public.bookings where user_id = 'b1000000-0000-4000-8000-000000000001'),
  1, 'repeat submissions create no second booking');

select throws_ok(
  $$select public.reserve_seat('b1000000-0000-4000-8000-000000000012', 'b0100000-0000-4000-8000-000000000033')$$,
  '23514', null, 'a class that already started cannot be booked');
select throws_ok(
  $$select public.reserve_seat('b0100000-0000-4000-8000-000000000053', 'b0100000-0000-4000-8000-000000000033')$$,
  '23514', null, 'a cancelled class cannot be booked');
select throws_ok(
  $$select public.reserve_seat('b1000000-0000-4000-8000-000000000013', 'b0100000-0000-4000-8000-000000000033')$$,
  '23514', null, 'a class of an inactive course cannot be booked');
select throws_ok(
  $$select public.reserve_seat('b1000000-0000-4000-8000-0000000000ff', 'b0100000-0000-4000-8000-000000000033')$$,
  'P0002', null, 'an unknown class cannot be booked');
select throws_ok(
  $$select public.reserve_seat('b1000000-0000-4000-8000-000000000014', null)$$,
  '23502', null, 'a reservation needs a material choice');
select lives_ok(
  $$insert into reserved select 'today', public.reserve_seat('b1000000-0000-4000-8000-000000000014', 'b0100000-0000-4000-8000-000000000033')$$,
  'a class starting later today can still be booked');

select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select lives_ok(
  $$insert into reserved select 'second', public.reserve_seat('b1000000-0000-4000-8000-000000000011', 'b0100000-0000-4000-8000-000000000033')$$,
  'a second student takes the last seat');

select throws_ok(
  $$update public.bookings set expires_at = now() + interval '30 days' where user_id = 'b1000000-0000-4000-8000-000000000002'$$,
  '42501', null, 'a student cannot extend a hold');

select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select throws_ok(
  $$select public.reserve_seat('b1000000-0000-4000-8000-000000000011', 'b0100000-0000-4000-8000-000000000033')$$,
  '23514', null, 'a third student cannot book a full class');

select is(
  (select public.seats_taken(cs) from public.course_sessions cs where id = 'b1000000-0000-4000-8000-000000000011'),
  2, 'both holds count against capacity');

select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select throws_ok(
  $$select public.reserve_seat('b1000000-0000-4000-8000-000000000011', 'b0100000-0000-4000-8000-000000000033')$$,
  '42501', 'Only active students can book classes', 'an inactive student cannot book');
select set_config('request.jwt.claims', '{"sub":"b0100000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select throws_ok(
  $$select public.reserve_seat('b1000000-0000-4000-8000-000000000011', 'b0100000-0000-4000-8000-000000000033')$$,
  '42501', 'Only active students can book classes', 'an admin cannot book as a student');
select throws_ok(
  $$select public.expire_seat_holds()$$,
  '42501', null, 'signed-in users cannot run the hold cleanup');
reset role;

set local role anon;
select throws_ok(
  $$select public.reserve_seat('b1000000-0000-4000-8000-000000000011', 'b0100000-0000-4000-8000-000000000033')$$,
  '42501', null, 'anonymous callers cannot book');
reset role;

update public.bookings set expires_at = now() - interval '1 second'
where user_id = 'b1000000-0000-4000-8000-000000000001' and course_session_id = 'b1000000-0000-4000-8000-000000000011';

select results_eq(
  $$select b.booking_status, public.holds_seat(b), public.seats_taken(cs)
    from public.bookings b join public.course_sessions cs on cs.id = b.course_session_id
    where b.user_id = 'b1000000-0000-4000-8000-000000000001' and cs.id = 'b1000000-0000-4000-8000-000000000011'$$,
  $$values ('Pending', false, 1)$$,
  'an expired hold stops counting before any cleanup runs');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select lives_ok(
  $$insert into reserved select 'third', public.reserve_seat('b1000000-0000-4000-8000-000000000011', 'b0100000-0000-4000-8000-000000000033')$$,
  'the released seat goes to the next student');

select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok(
  $$select public.reserve_seat('b1000000-0000-4000-8000-000000000011', 'b0100000-0000-4000-8000-000000000033')$$,
  '23514', null, 'the student whose hold expired cannot take a seat that is gone');
reset role;

update public.bookings set booking_status = 'Cancelled'
where user_id = 'b1000000-0000-4000-8000-000000000002' and course_session_id = 'b1000000-0000-4000-8000-000000000011';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok(
  $$insert into reserved select 'first rebooked', public.reserve_seat('b1000000-0000-4000-8000-000000000011', 'b0100000-0000-4000-8000-000000000033')$$,
  'a student whose hold expired books again once a seat frees up');
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok(
  $$select public.reserve_seat('b1000000-0000-4000-8000-000000000011', 'b0100000-0000-4000-8000-000000000033')$$,
  '23514', null, 'the cancelled seat was the one that went');
reset role;

select results_eq(
  $$select booking_status, expires_at = now() + interval '72 hours', material_fee
    from public.bookings
    where user_id = 'b1000000-0000-4000-8000-000000000001' and course_session_id = 'b1000000-0000-4000-8000-000000000011'
    order by booking_status$$,
  $$values ('Expired', false, 150.00::numeric), ('Pending', true, 0.00::numeric)$$,
  'rebooking marks the expired hold Expired and starts a new 72-hour hold');

update public.course_sessions set max_students = 3 where id = 'b1000000-0000-4000-8000-000000000011';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select lives_ok(
  $$insert into reserved select 'second rebooked', public.reserve_seat('b1000000-0000-4000-8000-000000000011', 'b0100000-0000-4000-8000-000000000061')$$,
  'a student whose booking was cancelled books again');
reset role;

select results_eq(
  $$select booking_status from public.bookings
    where user_id = 'b1000000-0000-4000-8000-000000000002' and course_session_id = 'b1000000-0000-4000-8000-000000000011'
    order by booking_status$$,
  $$values ('Cancelled'), ('Pending')$$,
  'the cancelled attempt stays beside the new hold');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0100000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select results_eq(
  $$select (public.reserve_seat('b0100000-0000-4000-8000-000000000025', 'b0100000-0000-4000-8000-000000000061')).id$$,
  $$values ('b0100000-0000-4000-8000-000000000034'::uuid)$$,
  'a student with a confirmed booking gets that booking back');
reset role;

select lives_ok(
  $$insert into public.bookings (id, user_id, course_session_id, material_type_id, booking_status, expires_at)
    values ('b1000000-0000-4000-8000-000000000031', 'b0100000-0000-4000-8000-000000000013', 'b1000000-0000-4000-8000-000000000014',
            'b0100000-0000-4000-8000-000000000033', 'Pending', now() + interval '1 year')$$,
  'a writer inserts a pending booking with its own expiry');
select is(
  (select expires_at from public.bookings where id = 'b1000000-0000-4000-8000-000000000031'),
  now() + interval '72 hours', 'every pending booking is held for exactly 72 hours');

update public.bookings set expires_at = now() - interval '1 minute' where id = 'b1000000-0000-4000-8000-000000000031';
update public.bookings set booking_status = 'Confirmed', expires_at = null where id = (select (booking).id from reserved where label = 'today');
insert into public.bookings (id, user_id, course_session_id, material_type_id, booking_status)
values ('b1000000-0000-4000-8000-000000000032', 'b1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000014',
        'b0100000-0000-4000-8000-000000000033', 'Pending');
update public.bookings set expires_at = null where id = 'b1000000-0000-4000-8000-000000000032';

select is(
  (select public.seats_taken(cs) from public.course_sessions cs where id = 'b1000000-0000-4000-8000-000000000014'),
  2, 'a confirmed booking and a pending booking from before holds keep their seats; an expired hold does not');

select lives_ok(
  $$update public.course_sessions set max_students = 2 where id = 'b1000000-0000-4000-8000-000000000014'$$,
  'capacity can be cut down to the seats actually held, ignoring expired holds');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0100000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select is(
  public.cancel_class('b1000000-0000-4000-8000-000000000014', 'Fixture room flooded'),
  2, 'cancelling a class cancels only the bookings that hold a seat');
reset role;

select bag_eq(
  $$select id, booking_status from public.bookings where course_session_id = 'b1000000-0000-4000-8000-000000000014'$$,
  $$values ('b1000000-0000-4000-8000-000000000031'::uuid, 'Pending'),
           ('b1000000-0000-4000-8000-000000000032'::uuid, 'Class Cancelled'),
           ((select (booking).id from reserved where label = 'today'), 'Class Cancelled')$$,
  'the expired hold is left for cleanup instead of being reported as cancelled');

insert into public.bookings (id, user_id, course_session_id, material_type_id, booking_status)
values ('b1000000-0000-4000-8000-000000000041', 'b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000015',
        'b0100000-0000-4000-8000-000000000033', 'Pending');
update public.bookings set expires_at = now() - interval '1 second' where id = 'b1000000-0000-4000-8000-000000000041';
insert into public.bookings (id, user_id, course_session_id, material_type_id, booking_status)
values ('b1000000-0000-4000-8000-000000000042', 'b1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000015',
        'b0100000-0000-4000-8000-000000000033', 'Pending');
alter table public.bookings disable trigger check_booking_seat;
update public.bookings set expires_at = clock_timestamp() where id = 'b1000000-0000-4000-8000-000000000041';
alter table public.bookings enable trigger check_booking_seat;
select pg_sleep(0.01);

select ok(
  (select public.holds_seat(b) and b.expires_at < clock_timestamp() from public.bookings b where id = 'b1000000-0000-4000-8000-000000000041'),
  'a hold that lapsed after this transaction began still looks live to it');
select throws_ok(
  $$update public.bookings set booking_status = 'Confirmed' where id = 'b1000000-0000-4000-8000-000000000041'$$,
  '23514', null, 'confirming that hold is refused once another student has taken its seat');

create temporary table lapsed on commit drop as
select id from public.bookings where booking_status = 'Pending' and expires_at <= now();

select is(public.expire_seat_holds(), (select count(*)::int from lapsed), 'the cleanup expires every lapsed hold');
select bag_eq(
  $$select booking_status from public.bookings where id in (select id from lapsed)$$,
  $$select 'Expired'::text from lapsed$$,
  'each lapsed hold is marked Expired');
select is(public.expire_seat_holds(), 0, 'running the cleanup again changes nothing');
select is(
  (select count(*)::int from public.bookings where booking_status = 'Pending' and holds_seat(bookings)),
  (select count(*)::int from public.bookings where booking_status = 'Pending'),
  'after cleanup every pending booking still holds its seat');

select results_eq(
  $$select schedule, command from cron.job where jobname = 'expire-seat-holds'$$,
  $$values ('*/5 * * * *', 'select public.expire_seat_holds()')$$,
  'pg_cron runs the cleanup every five minutes');

select has_column('public', 'bookings', 'expires_at', 'bookings record when a hold expires');
select hasnt_function('public', 'booking_holds_seat', array['text'], 'the status-only seat rule is gone');

select * from finish();
rollback;
