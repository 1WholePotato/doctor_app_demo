begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(27);

insert into public.courses (id, course_title, course_description, course_price, printed_material_fee)
values ('b1100000-0000-4000-8000-000000000020', 'Fixture Free Course', 'Costs nothing.', 0, 0);
insert into public.course_sessions (id, course_id, location_id, start_date, end_date, start_time, end_time, max_students)
values ('b1100000-0000-4000-8000-000000000011', 'b0100000-0000-4000-8000-000000000023', 'b0100000-0000-4000-8000-000000000022',
        current_date + 70, current_date + 70, '09:00', '12:00', 10),
       ('b1100000-0000-4000-8000-000000000012', 'b1100000-0000-4000-8000-000000000020', 'b0100000-0000-4000-8000-000000000022',
        current_date + 70, current_date + 70, '09:00', '12:00', 10);
insert into public.bookings (id, user_id, course_session_id, material_type_id, booking_status)
values ('b1100000-0000-4000-8000-000000000031', 'b0100000-0000-4000-8000-000000000012', 'b1100000-0000-4000-8000-000000000011',
        'b0100000-0000-4000-8000-000000000033', 'Pending'),
       ('b1100000-0000-4000-8000-000000000032', 'b0100000-0000-4000-8000-000000000012', 'b1100000-0000-4000-8000-000000000012',
        'b0100000-0000-4000-8000-000000000033', 'Pending'),
       ('b1100000-0000-4000-8000-000000000033', 'b0100000-0000-4000-8000-000000000014', 'b1100000-0000-4000-8000-000000000011',
        'b0100000-0000-4000-8000-000000000033', 'Pending');
update public.bookings set expires_at = null where id = 'b1100000-0000-4000-8000-000000000031';
update public.bookings set expires_at = now() - interval '1 minute' where id = 'b1100000-0000-4000-8000-000000000033';

create temporary table started (label text primary key, attempt public.payment_attempts) on commit drop;
grant all on started to service_role, authenticated;

select ok((select relrowsecurity from pg_class where oid = 'public.payment_attempts'::regclass), 'payment attempts have row level security');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0100000-0000-4000-8000-000000000014","role":"authenticated"}', true);
select throws_ok(
  $$select public.begin_payment_attempt('b0100000-0000-4000-8000-000000000071', 'b0100000-0000-4000-8000-000000000014')$$,
  '42501', null, 'a student cannot start a payment attempt through the API');
reset role;
set local role anon;
select throws_ok(
  $$select public.begin_payment_attempt('b0100000-0000-4000-8000-000000000071', 'b0100000-0000-4000-8000-000000000014')$$,
  '42501', null, 'anon cannot start a payment attempt');
reset role;

set local role service_role;
select lives_ok(
  $$insert into started select 'held', public.begin_payment_attempt('b0100000-0000-4000-8000-000000000071', 'b0100000-0000-4000-8000-000000000014')$$,
  'the checkout starts an attempt for a held booking');
select results_eq(
  $$select (attempt).booking_id, (attempt).amount, (attempt).expires_at, (attempt).status, (attempt).ozow_payment_id, (attempt).redirect_url
    from started where label = 'held'$$,
  $$select id, 250.00::numeric, expires_at, 'open', null::text, null::text from public.bookings where id = 'b0100000-0000-4000-8000-000000000071'$$,
  'the attempt copies the stored total and the hold expiry');
select matches((select (attempt).reference from started where label = 'held'), '^DA[0-9A-F]{10}$',
  'the reference is DA and ten hex digits, inside Ozow''s 20 letters and digits');
select lives_ok(
  $$insert into started select 'held again', public.begin_payment_attempt('b0100000-0000-4000-8000-000000000071', 'b0100000-0000-4000-8000-000000000014')$$,
  'a retry while the attempt is open');
select is((select (attempt).id from started where label = 'held again'), (select (attempt).id from started where label = 'held'),
  'a retry returns the open attempt');
select is((select count(*)::int from public.payment_attempts where booking_id = 'b0100000-0000-4000-8000-000000000071' and status = 'open'), 1,
  'a retry adds no attempt');

select throws_ok(
  $$select public.begin_payment_attempt('b0100000-0000-4000-8000-000000000071', 'b0100000-0000-4000-8000-000000000012')$$,
  '42501', 'Booking b0100000-0000-4000-8000-000000000071 belongs to another student', 'another student''s booking is refused');
select throws_ok(
  $$select public.begin_payment_attempt('b0100000-0000-4000-8000-000000000034', 'b0100000-0000-4000-8000-000000000012')$$,
  '23514', 'Booking b0100000-0000-4000-8000-000000000034 is not awaiting payment', 'a confirmed booking is refused');
select throws_ok(
  $$select public.begin_payment_attempt('b0100000-0000-4000-8000-000000000037', 'b0100000-0000-4000-8000-000000000012')$$,
  '23514', 'Booking b0100000-0000-4000-8000-000000000037 is not awaiting payment', 'a cancelled booking is refused');
select throws_ok(
  $$select public.begin_payment_attempt('b1100000-0000-4000-8000-000000000033', 'b0100000-0000-4000-8000-000000000014')$$,
  '23514', 'The seat hold on booking b1100000-0000-4000-8000-000000000033 has expired', 'a lapsed hold is refused before cleanup marks it Expired');
select throws_ok(
  $$select public.begin_payment_attempt('b1100000-0000-4000-8000-000000000031', 'b0100000-0000-4000-8000-000000000012')$$,
  '23514', 'The seat hold on booking b1100000-0000-4000-8000-000000000031 has expired', 'a legacy hold without an expiry is refused');
select throws_ok(
  $$select public.begin_payment_attempt('b1100000-0000-4000-8000-000000000032', 'b0100000-0000-4000-8000-000000000012')$$,
  '23514', 'Booking b1100000-0000-4000-8000-000000000032 has nothing to pay', 'a free booking is refused');
select throws_ok(
  $$select public.begin_payment_attempt('b1100000-0000-4000-8000-0000000000ff', 'b0100000-0000-4000-8000-000000000012')$$,
  'P0002', 'Booking b1100000-0000-4000-8000-0000000000ff does not exist', 'an unknown booking is refused');

select throws_ok(
  $$insert into public.payment_attempts (booking_id, amount, expires_at)
    values ('b0100000-0000-4000-8000-000000000071', 250, now() + interval '1 hour')$$,
  '23505', null, 'the database refuses a second open attempt for one booking');
select throws_ok(
  $$insert into public.payment_attempts (booking_id, reference, amount, expires_at, status)
    values ('b0100000-0000-4000-8000-000000000071', 'DA-123', 250, now() + interval '1 hour', 'failed')$$,
  '23514', null, 'a reference Ozow would reject cannot be stored');
select throws_ok(
  $$update public.payment_attempts set redirect_url = 'https://pay.example.test/x' where booking_id = 'b0100000-0000-4000-8000-000000000071'$$,
  '23514', null, 'a redirect URL needs the Ozow payment it belongs to');

update public.payment_attempts set status = 'failed' where booking_id = 'b0100000-0000-4000-8000-000000000071';
select lives_ok(
  $$insert into started select 'after failure', public.begin_payment_attempt('b0100000-0000-4000-8000-000000000071', 'b0100000-0000-4000-8000-000000000014')$$,
  'a failed attempt lets the student start again');
select results_eq(
  $$select a.id <> h.id, (a).reference <> (h).reference
    from (select (attempt).* from started where label = 'after failure') a, (select (attempt).* from started where label = 'held') h$$,
  $$values (true, true)$$,
  'the new attempt has its own id and reference');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0100000-0000-4000-8000-000000000014","role":"authenticated"}', true);
select results_eq(
  $$select booking_id, status, count(*)::int from public.payment_attempts group by 1, 2 order by 2$$,
  $$values ('b0100000-0000-4000-8000-000000000071'::uuid, 'failed', 2), ('b0100000-0000-4000-8000-000000000071'::uuid, 'open', 1)$$,
  'a student sees the seeded, failed and open attempts on their own booking');
select throws_ok(
  $$insert into public.payment_attempts (booking_id, amount, expires_at) values ('b0100000-0000-4000-8000-000000000071', 1, now())$$,
  '42501', null, 'a student cannot create an attempt');
select throws_ok(
  $$update public.payment_attempts set amount = 1, status = 'open'$$,
  '42501', null, 'a student cannot change an attempt');
select throws_ok($$delete from public.payment_attempts$$, '42501', null, 'a student cannot delete an attempt');
select set_config('request.jwt.claims', '{"sub":"b0100000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select is((select count(*)::int from public.payment_attempts where booking_id = 'b0100000-0000-4000-8000-000000000071'), 0, 'another student sees none of them');
reset role;

set local role anon;
select throws_ok($$select count(*) from public.payment_attempts$$, '42501', null, 'anon cannot read attempts');
reset role;

select * from finish();
rollback;
