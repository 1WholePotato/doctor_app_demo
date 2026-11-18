begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(45);

select hasnt_column('public', 'course_sessions', 'active', 'class lifecycle lives in course_sessions.status');
select col_not_null('public', 'course_sessions', 'status', 'every class has a lifecycle status');

select throws_ok(
  $$insert into public.course_sessions (course_id, location_id, start_date, end_date, start_time, end_time, max_students)
    values ('b0100000-0000-4000-8000-000000000023', 'b0100000-0000-4000-8000-000000000022', current_date + 10, current_date + 9, '09:00', '12:00', 10)$$,
  '23514', null, 'a class cannot end on a date before it starts');
select throws_ok(
  $$insert into public.course_sessions (course_id, location_id, start_date, end_date, start_time, end_time, max_students)
    values ('b0100000-0000-4000-8000-000000000023', 'b0100000-0000-4000-8000-000000000022', current_date + 10, current_date + 10, '12:00', '12:00', 10)$$,
  '23514', null, 'a class must end after it starts each day');
select throws_ok(
  $$insert into public.course_sessions (course_id, location_id, start_date, end_date, start_time, end_time, max_students)
    values ('b0100000-0000-4000-8000-000000000023', 'b0100000-0000-4000-8000-000000000022', current_date + 10, current_date + 10, '09:00', '12:00', 0)$$,
  '23514', null, 'a class needs a positive capacity');
select throws_ok(
  $$insert into public.course_sessions (course_id, location_id, start_date, end_date, start_time, end_time, status)
    values ('b0100000-0000-4000-8000-000000000023', 'b0100000-0000-4000-8000-000000000022', current_date + 10, current_date + 10, '09:00', '12:00', 'postponed')$$,
  '23514', null, 'a class status is scheduled or cancelled');
select throws_ok(
  $$insert into public.locations (name, address) values ('  fixture training ROOM ', null)$$,
  '23505', null, 'location names are unique ignoring case and spaces');
select throws_ok(
  $$insert into public.locations (name) values ('   ')$$,
  '23514', null, 'a location needs a name');

insert into auth.users (instance_id, id, aud, role, email)
values ('00000000-0000-0000-0000-000000000000', 'b0700000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'b07-student-1@example.test'),
       ('00000000-0000-0000-0000-000000000000', 'b0700000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'b07-student-2@example.test');
insert into public.users (id, role_id, first_name, last_name, birth_date, passport_num, cell_num, email, sanc_num)
values ('b0700000-0000-4000-8000-000000000001', '4fd9e72e-f94b-4222-b5c1-95b447088d4d', 'Capacity', 'One', '1990-01-01', 'B07-1', '0000000701', 'b07-student-1@example.test', 'B07-1'),
       ('b0700000-0000-4000-8000-000000000002', '4fd9e72e-f94b-4222-b5c1-95b447088d4d', 'Capacity', 'Two', '1990-01-01', 'B07-2', '0000000702', 'b07-student-2@example.test', 'B07-2');

select lives_ok(
  $$insert into public.bookings (user_id, course_session_id, total_amount, booking_status)
    values ('b0100000-0000-4000-8000-000000000012', 'b0100000-0000-4000-8000-000000000052', 100, 'Confirmed'),
           ('b0700000-0000-4000-8000-000000000001', 'b0100000-0000-4000-8000-000000000052', 100, 'Pending')$$,
  'a class takes bookings up to its capacity');
select throws_ok(
  $$insert into public.bookings (user_id, course_session_id, total_amount, booking_status)
    values ('b0700000-0000-4000-8000-000000000002', 'b0100000-0000-4000-8000-000000000052', 100, 'Pending')$$,
  '23514', null, 'a booking past capacity is rejected');
select lives_ok(
  $$insert into public.bookings (user_id, course_session_id, total_amount, booking_status)
    values ('b0700000-0000-4000-8000-000000000002', 'b0100000-0000-4000-8000-000000000052', 100, 'Cancelled')$$,
  'a cancelled attempt does not take a seat');
select throws_ok(
  $$update public.bookings set booking_status = 'Pending'
    where user_id = 'b0700000-0000-4000-8000-000000000002' and course_session_id = 'b0100000-0000-4000-8000-000000000052'$$,
  '23514', null, 'reactivating a booking in a full class is rejected');
select throws_ok(
  $$update public.course_sessions set max_students = 1 where id = 'b0100000-0000-4000-8000-000000000052'$$,
  '23514', null, 'capacity cannot drop below committed occupancy, even by direct update');
select throws_ok(
  $$update public.course_sessions set status = 'cancelled', cancelled_at = now() where id = 'b0100000-0000-4000-8000-000000000052'$$,
  '23514', null, 'a class with active bookings cannot be marked cancelled without cancelling them');

set local role anon;
select throws_ok(
  $$select public.schedule_class('b0100000-0000-4000-8000-000000000023', 'b0100000-0000-4000-8000-000000000022', current_date + 5, current_date + 5, '09:00', '12:00', 10, array['b0100000-0000-4000-8000-000000000021']::uuid[])$$,
  '42501', null, 'anonymous callers cannot schedule classes');
select throws_ok(
  $$select public.cancel_class('b0100000-0000-4000-8000-000000000025', 'nope')$$,
  '42501', null, 'anonymous callers cannot cancel classes');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0100000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select throws_ok(
  $$select public.schedule_class('b0100000-0000-4000-8000-000000000023', 'b0100000-0000-4000-8000-000000000022', current_date + 5, current_date + 5, '09:00', '12:00', 10, array['b0100000-0000-4000-8000-000000000021']::uuid[])$$,
  '42501', 'Only admins can schedule classes', 'students cannot schedule classes');
select throws_ok(
  $$select public.reschedule_class('b0100000-0000-4000-8000-000000000025', 'b0100000-0000-4000-8000-000000000022', current_date + 31, current_date + 31, '09:00', '12:00', 20)$$,
  '42501', 'Only admins can reschedule classes', 'students cannot reschedule classes');
select throws_ok(
  $$select public.cancel_class('b0100000-0000-4000-8000-000000000025', 'Student says so')$$,
  '42501', 'Only admins can cancel classes', 'students cannot cancel classes');
select throws_ok('select * from public.course_session_changes', '42501', null, 'signed-in users cannot read the class change log');

select set_config('request.jwt.claims', '{"sub":"b0100000-0000-4000-8000-000000000011","role":"authenticated"}', true);

create temporary table scheduled (id uuid) on commit drop;
grant all on scheduled to authenticated;
select lives_ok(
  $$insert into scheduled
    select public.schedule_class('b0100000-0000-4000-8000-000000000023', 'b0100000-0000-4000-8000-000000000051',
      current_date + 60, current_date + 61, '09:00', '15:00', 8,
      array['b0100000-0000-4000-8000-000000000021', 'b0100000-0000-4000-8000-000000000041']::uuid[])$$,
  'an admin schedules a class with location, dates, times, capacity and instructors');
select results_eq(
  $$select cs.status, cs.location_id, cs.start_date, cs.end_date, cs.start_time, cs.end_time, cs.max_students,
           (select array_agg(si.instructor_id order by si.instructor_id) from public.session_instructors si where si.course_session_id = cs.id)
    from public.course_sessions cs join scheduled on scheduled.id = cs.id$$,
  $$values ('scheduled', 'b0100000-0000-4000-8000-000000000051'::uuid, current_date + 60, current_date + 61, '09:00'::time, '15:00'::time, 8,
            array['b0100000-0000-4000-8000-000000000021', 'b0100000-0000-4000-8000-000000000041']::uuid[])$$,
  'the scheduled class stores what the admin entered');

select throws_ok(
  $$select public.schedule_class('b0100000-0000-4000-8000-000000000023', 'b0100000-0000-4000-8000-000000000022', current_date + 5, current_date + 5, '09:00', '12:00', 10, array['b0100000-0000-4000-8000-000000000042']::uuid[])$$,
  '23514', null, 'scheduling with an unauthorized instructor fails');
select throws_ok(
  $$select public.schedule_class('b0100000-0000-4000-8000-000000000023', 'b0100000-0000-4000-8000-000000000022', current_date + 5, current_date + 5, '09:00', '12:00', 10, array[]::uuid[])$$,
  '22023', 'A class needs at least one instructor', 'scheduling without instructors fails');
select throws_ok(
  $$select public.schedule_class('b0100000-0000-4000-8000-000000000023', 'b0100000-0000-4000-8000-000000000022', current_date - 1, current_date - 1, '09:00', '12:00', 10, array['b0100000-0000-4000-8000-000000000021']::uuid[])$$,
  '23514', 'A class cannot start in the past', 'scheduling in the past fails');
select throws_ok(
  $$select public.schedule_class('b0100000-0000-4000-8000-000000000023', 'b0100000-0000-4000-8000-000000000022', current_date + 5, current_date + 5, '12:00', '09:00', 10, array['b0100000-0000-4000-8000-000000000021']::uuid[])$$,
  '23514', null, 'scheduling an inverted time range fails');
select is(
  (select count(*)::int from public.course_sessions where start_date = current_date + 5),
  0, 'rejected schedules leave no partial class behind');

select throws_ok(
  $$select public.reschedule_class('b0100000-0000-4000-8000-000000000052', 'b0100000-0000-4000-8000-000000000051', current_date + 45, current_date + 46, '08:30', '16:00', 1)$$,
  '23514', 'Capacity 1 is below the 2 active bookings for this class', 'rescheduling cannot cut capacity below committed occupancy');
select throws_ok(
  $$select public.reschedule_class('b0100000-0000-4000-8000-000000000052', 'b0100000-0000-4000-8000-000000000051', current_date + 45, current_date + 44, '08:30', '16:00', 2)$$,
  '23514', null, 'rescheduling to an end date before the start fails');
select throws_ok(
  $$select public.reschedule_class('b0100000-0000-4000-8000-000000000052', 'b0100000-0000-4000-8000-000000000051', current_date - 2, current_date - 2, '08:30', '16:00', 2)$$,
  '23514', 'A class cannot be moved into the past', 'rescheduling into the past fails');

select lives_ok(
  $$select public.reschedule_class('b0100000-0000-4000-8000-000000000052', 'b0100000-0000-4000-8000-000000000022', current_date + 50, current_date + 50, '10:00', '13:00', 3)$$,
  'an admin moves a class to a new location, date, time and capacity');
select results_eq(
  $$select b.user_id, cs.location_id, cs.start_date, cs.start_time, cs.max_students, cs.rescheduled_at is not null
    from public.bookings b join public.course_sessions cs on cs.id = b.course_session_id
    where cs.id = 'b0100000-0000-4000-8000-000000000052' and b.booking_status in ('Pending', 'Confirmed', 'Completed')
    order by b.user_id$$,
  $$values ('b0100000-0000-4000-8000-000000000012'::uuid, 'b0100000-0000-4000-8000-000000000022'::uuid, current_date + 50, '10:00'::time, 3, true),
           ('b0700000-0000-4000-8000-000000000001'::uuid, 'b0100000-0000-4000-8000-000000000022'::uuid, current_date + 50, '10:00'::time, 3, true)$$,
  'booked students see the rescheduled class through their booking');
select lives_ok(
  $$update public.bookings set booking_status = 'Pending'
    where user_id = 'b0700000-0000-4000-8000-000000000002' and course_session_id = 'b0100000-0000-4000-8000-000000000052'$$,
  'the added seat can be booked');
select lives_ok(
  $$select public.reschedule_class('b0100000-0000-4000-8000-000000000052', 'b0100000-0000-4000-8000-000000000022', current_date + 50, current_date + 50, '10:00', '13:00', 3)$$,
  'saving an unchanged schedule is a no-op');
reset role;
select results_eq(
  $$select change, previous->>'start_date', previous->>'max_students', current->>'start_date', current->>'max_students', changed_by
    from public.course_session_changes where course_session_id = 'b0100000-0000-4000-8000-000000000052'$$,
  $$values ('rescheduled', (current_date + 45)::text, '2', (current_date + 50)::text, '3', 'b0100000-0000-4000-8000-000000000011'::uuid)$$,
  'one reschedule is logged with the previous and new schedule and the admin who made it');
set local role authenticated;

select throws_ok(
  $$select public.cancel_class('b0100000-0000-4000-8000-000000000052', '   ')$$,
  '22023', 'Give a reason for cancelling the class', 'cancelling needs a reason');
select is(
  public.cancel_class('b0100000-0000-4000-8000-000000000052', 'Instructor unavailable'),
  3, 'cancelling a class reports how many bookings it affected');
select results_eq(
  $$select booking_status, count(*)::int from public.bookings where course_session_id = 'b0100000-0000-4000-8000-000000000052' group by booking_status order by booking_status$$,
  $$values ('Class Cancelled', 3)$$,
  'every active booking of the cancelled class is marked Class Cancelled and kept');
select results_eq(
  $$select status, cancelled_at is not null, cancellation_reason from public.course_sessions where id = 'b0100000-0000-4000-8000-000000000052'$$,
  $$values ('cancelled', true, 'Instructor unavailable')$$,
  'the class records its cancellation');
reset role;
select is(
  (select jsonb_array_length(previous->'bookings') from public.course_session_changes
   where course_session_id = 'b0100000-0000-4000-8000-000000000052' and change = 'cancelled'),
  3, 'the cancellation log keeps each booking and its previous status');
set local role authenticated;
select is(
  public.cancel_class('b0100000-0000-4000-8000-000000000052', 'Instructor unavailable'),
  0, 'cancelling an already cancelled class changes nothing');

select throws_ok(
  $$select public.reschedule_class('b0100000-0000-4000-8000-000000000052', 'b0100000-0000-4000-8000-000000000022', current_date + 70, current_date + 70, '10:00', '13:00', 3)$$,
  '23514', null, 'a cancelled class cannot be rescheduled');
select throws_ok(
  $$update public.bookings set booking_status = 'Confirmed'
    where user_id = 'b0700000-0000-4000-8000-000000000001' and course_session_id = 'b0100000-0000-4000-8000-000000000052'$$,
  '23514', null, 'a booking in a cancelled class cannot be reactivated');
reset role;

select throws_ok(
  $$update public.course_sessions set status = 'scheduled', cancelled_at = null where id = 'b0100000-0000-4000-8000-000000000052'$$,
  '23514', null, 'a cancelled class stays cancelled, even by direct update');
select throws_ok(
  $$insert into public.bookings (user_id, course_session_id, total_amount, booking_status)
    values ('b0700000-0000-4000-8000-000000000001', 'b0100000-0000-4000-8000-000000000053', 100, 'Pending')$$,
  '23514', null, 'a cancelled class takes no new bookings');

select * from finish();
rollback;
