begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(13);

select fk_ok('public', 'bookings', 'course_session_id', 'public', 'course_sessions', 'id');
select hasnt_column('public', 'bookings', 'payment_status', 'payment state lives only in payments');
select hasnt_column('public', 'bookings', 'booking_status_id', 'booking state lives only in bookings.booking_status');

select throws_ok(
  $$insert into public.bookings (user_id, course_session_id, material_type_id, booking_status)
    values ('b0100000-0000-4000-8000-000000000012', 'b0100000-0000-4000-8000-000000000023', 'b0100000-0000-4000-8000-000000000033', 'Pending')$$,
  '23503', null, 'a course id is not a valid session reference');

select throws_ok(
  $$insert into public.bookings (user_id, course_session_id, material_type_id, booking_status)
    values ('b0100000-0000-4000-8000-000000000012', null, 'b0100000-0000-4000-8000-000000000033', 'Pending')$$,
  '23514', null, 'a new booking must name a session');

select throws_ok(
  $$insert into public.bookings (user_id, course_session_id, material_type_id, booking_status)
    values ('b0100000-0000-4000-8000-000000000012', 'b0100000-0000-4000-8000-000000000025', 'b0100000-0000-4000-8000-000000000033', 'Waitlisted')$$,
  '23503', null, 'booking status must exist in booking_statuses');

select throws_ok(
  $$insert into public.bookings (user_id, course_session_id, material_type_id, booking_status)
    values ('b0100000-0000-4000-8000-000000000012', 'b0100000-0000-4000-8000-000000000025', 'b0100000-0000-4000-8000-000000000033', 'Pending')$$,
  '23505', null, 'a second active booking for the same student and session fails');

select lives_ok(
  $$insert into public.bookings (user_id, course_session_id, material_type_id, booking_status)
    values ('b0100000-0000-4000-8000-000000000012', 'b0100000-0000-4000-8000-000000000025', 'b0100000-0000-4000-8000-000000000033', 'Cancelled')$$,
  'cancelled attempts for the same student and session are kept alongside the active booking');

select is(
  (select array_agg(booking_status order by booking_status)
   from public.bookings
   where user_id = 'b0100000-0000-4000-8000-000000000012'
     and course_session_id = 'b0100000-0000-4000-8000-000000000025'),
  array['Cancelled', 'Cancelled', 'Confirmed'],
  'historical attempts stay intact next to the active booking');

update public.bookings set booking_status = 'Cancelled' where id = 'b0100000-0000-4000-8000-000000000034';

select lives_ok(
  $$insert into public.bookings (user_id, course_session_id, material_type_id, booking_status)
    values ('b0100000-0000-4000-8000-000000000012', 'b0100000-0000-4000-8000-000000000025', 'b0100000-0000-4000-8000-000000000033', 'Pending')$$,
  'a student can rebook a session once the earlier booking is cancelled');

select throws_ok(
  $$update public.bookings set booking_status = 'Confirmed' where id = 'b0100000-0000-4000-8000-000000000034'$$,
  '23505', null, 'reactivating a cancelled booking fails while another booking is active');

set local role authenticated;
select throws_ok(
  'select * from public.booking_review_flags', '42501', null,
  'signed-in users cannot read the review queue');
reset role;

set local role anon;
select throws_ok(
  $$insert into public.booking_review_flags (booking_id, reason, details)
    values ('b0100000-0000-4000-8000-000000000034', 'ambiguous_session', '{}')$$,
  '42501', null, 'anonymous callers cannot write the review queue');
reset role;

select * from finish();
rollback;
