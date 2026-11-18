begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(16);

create function pg_temp.investigate(p_payment text, p_reference text)
returns text
language sql
as $$
  select public.settle_payment_attempt(p_payment, jsonb_build_array(jsonb_build_object(
    'id', 'tx-' || p_payment, 'merchantReference', p_reference, 'siteCode', 'MCK-MCK-001', 'institution', 'Fixture Bank',
    'amount', jsonb_build_object('currency', 'ZAR', 'value', 100), 'status', 'Pending', 'reason', 'PendingInvestigation',
    'createdDate', now(), 'completedDate', now())));
$$;

insert into public.course_sessions (id, course_id, location_id, start_date, end_date, start_time, end_time, max_students)
values ('b1300000-0000-4000-8000-000000000101', 'b0100000-0000-4000-8000-000000000023', 'b0100000-0000-4000-8000-000000000022',
        current_date + 40, current_date + 40, '09:00', '12:00', 1),
       ('b1300000-0000-4000-8000-000000000102', 'b0100000-0000-4000-8000-000000000023', 'b0100000-0000-4000-8000-000000000022',
        current_date + 41, current_date + 41, '09:00', '12:00', 5);
insert into public.session_instructors (course_session_id, instructor_id)
values ('b1300000-0000-4000-8000-000000000101', 'b0100000-0000-4000-8000-000000000021');

insert into public.bookings (id, user_id, course_session_id, material_type_id, booking_status)
values ('b1300000-0000-4000-8000-000000000111', 'b0100000-0000-4000-8000-000000000012', 'b1300000-0000-4000-8000-000000000101',
        'b0100000-0000-4000-8000-000000000033', 'Pending'),
       ('b1300000-0000-4000-8000-000000000112', 'b0100000-0000-4000-8000-000000000012', 'b1300000-0000-4000-8000-000000000102',
        'b0100000-0000-4000-8000-000000000033', 'Pending');
update public.bookings set expires_at = now() - interval '1 hour' where id = 'b1300000-0000-4000-8000-000000000112';

insert into public.payment_attempts (id, booking_id, reference, amount, expires_at, ozow_payment_id, redirect_url)
select a.id, b.id, a.reference, b.total_amount, b.expires_at, a.payment, 'https://pay.example.test/' || a.payment
from (values
  ('b1300000-0000-4000-8000-000000000121'::uuid, 'b1300000-0000-4000-8000-000000000111'::uuid, 'DAB13INV1', 'pay-b13-held'),
  ('b1300000-0000-4000-8000-000000000122'::uuid, 'b1300000-0000-4000-8000-000000000112'::uuid, 'DAB13INV2', 'pay-b13-lapsed')
) as a(id, booking, reference, payment)
join public.bookings b on b.id = a.booking;

set local role service_role;
select is(pg_temp.investigate('pay-b13-held', 'DAB13INV1'), 'investigating', 'Ozow reports the held booking''s payment for investigation');
select is(pg_temp.investigate('pay-b13-lapsed', 'DAB13INV2'), 'investigating', 'Ozow reports the lapsed booking''s payment for investigation');
reset role;
select lives_ok('select public.expire_seat_holds()', 'the hold expiry job runs during both investigations');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0100000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select results_eq(
  $$select b.id, b.booking_status, public.holds_seat(b), a.status
    from public.bookings b join public.payment_attempts a on a.booking_id = b.id
    where b.id in ('b1300000-0000-4000-8000-000000000111', 'b1300000-0000-4000-8000-000000000112') order by b.id$$,
  $$values ('b1300000-0000-4000-8000-000000000111'::uuid, 'Pending', true, 'investigating'),
           ('b1300000-0000-4000-8000-000000000112'::uuid, 'Expired', false, 'investigating')$$,
  'the student reads both investigating attempts; the held seat survives the expiry job and the lapsed hold expires');
select is(
  (select public.seats_taken(cs) from public.course_sessions cs where id = 'b1300000-0000-4000-8000-000000000101'),
  1, 'the seat held through the investigation still counts against the class');
select results_eq(
  $$select id, public.bookable(cs) from public.course_sessions cs
    where id in ('b1300000-0000-4000-8000-000000000101', 'b1300000-0000-4000-8000-000000000102') order by id$$,
  $$values ('b1300000-0000-4000-8000-000000000101'::uuid, false), ('b1300000-0000-4000-8000-000000000102'::uuid, true)$$,
  'the catalogue drops the class filled by the investigated seat and keeps the one whose hold lapsed');
select is(
  (select (public.reserve_seat('b1300000-0000-4000-8000-000000000101', 'b0100000-0000-4000-8000-000000000033')).id),
  'b1300000-0000-4000-8000-000000000111'::uuid, 'booking the investigated class again returns the held booking, not a second seat');
select throws_ok($$update public.payment_attempts set status = 'failed'$$, '42501', null,
  'the student cannot end the investigation themselves');

select set_config('request.jwt.claims', '{"sub":"b0100000-0000-4000-8000-000000000014","role":"authenticated"}', true);
select is_empty(
  $$select id from public.payment_attempts where booking_id in ('b1300000-0000-4000-8000-000000000111', 'b1300000-0000-4000-8000-000000000112')$$,
  'another student cannot read the investigated attempts');
select throws_ok(
  $$select public.reserve_seat('b1300000-0000-4000-8000-000000000101', 'b0100000-0000-4000-8000-000000000033')$$,
  '23514', null, 'another student cannot take the seat held through the investigation');

select set_config('request.jwt.claims', '{"sub":"b0100000-0000-4000-8000-000000000013","role":"authenticated"}', true);
select results_eq(
  $$select id from public.bookings where course_session_id = 'b1300000-0000-4000-8000-000000000101'$$,
  $$values ('b1300000-0000-4000-8000-000000000111'::uuid)$$,
  'the instructor sees the investigated booking in the class they teach');
select is_empty(
  $$select id from public.payment_attempts where booking_id = 'b1300000-0000-4000-8000-000000000111'$$,
  'the instructor cannot read its payment attempt');

select set_config('request.jwt.claims', '{"sub":"b0100000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.payment_attempts where status = 'investigating'),
  2, 'the admin reads every investigating attempt');
reset role;

set local role anon;
select throws_ok('select * from public.payment_attempts', '42501', null, 'anon cannot read payment attempts');
reset role;

select is(
  (select count(*)::int from public.bookings where user_id = 'b0100000-0000-4000-8000-000000000012'
     and course_session_id = 'b1300000-0000-4000-8000-000000000101'),
  1, 'the student still has exactly one booking in the investigated class');
select is(
  (select count(*)::int from public.payments where booking_id in ('b1300000-0000-4000-8000-000000000111', 'b1300000-0000-4000-8000-000000000112')),
  0, 'no payment is recorded while the bank investigates');

select * from finish();
rollback;
