begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(64);

create function pg_temp.tx(p_id text, p_reference text, p_value jsonb, p_status text, p_currency text default 'ZAR')
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'id', p_id, 'merchantReference', p_reference, 'siteCode', 'MCK-MCK-001', 'institution', 'Fixture Bank',
    'amount', jsonb_build_object('currency', p_currency, 'value', p_value), 'status', p_status,
    'createdDate', now(), 'completedDate', now());
$$;

create function pg_temp.settle(p_payment text, p_transactions jsonb)
returns text
language sql
as $$ select public.settle_payment_attempt(p_payment, p_transactions); $$;

create function pg_temp.paid_count(p_booking uuid)
returns integer
language sql
as $$
  select count(*)::integer from public.payments p join public.payment_statuses ps on ps.id = p.payment_status_id
  where p.booking_id = p_booking and ps.name = 'Paid';
$$;

insert into public.course_sessions (id, course_id, location_id, start_date, end_date, start_time, end_time, max_students)
values ('b1200000-0000-4000-8000-000000000001', 'b0100000-0000-4000-8000-000000000023', 'b0100000-0000-4000-8000-000000000022',
        current_date + 80, current_date + 80, '09:00', '12:00', 10),
       ('b1200000-0000-4000-8000-000000000002', 'b0100000-0000-4000-8000-000000000023', 'b0100000-0000-4000-8000-000000000022',
        current_date + 81, current_date + 81, '09:00', '12:00', 1),
       ('b1200000-0000-4000-8000-000000000003', 'b0100000-0000-4000-8000-000000000023', 'b0100000-0000-4000-8000-000000000022',
        current_date + 82, current_date + 82, '09:00', '12:00', 10),
       ('b1200000-0000-4000-8000-000000000004', 'b0100000-0000-4000-8000-000000000023', 'b0100000-0000-4000-8000-000000000022',
        current_date + 83, current_date + 83, '09:00', '12:00', 10);

insert into public.bookings (id, user_id, course_session_id, material_type_id, booking_status)
values ('b1200000-0000-4000-8000-0000000000a1', 'b0100000-0000-4000-8000-000000000012', 'b1200000-0000-4000-8000-000000000001',
        'b0100000-0000-4000-8000-000000000033', 'Pending'),
       ('b1200000-0000-4000-8000-0000000000b1', 'b0100000-0000-4000-8000-000000000014', 'b1200000-0000-4000-8000-000000000001',
        'b0100000-0000-4000-8000-000000000033', 'Pending'),
       ('b1200000-0000-4000-8000-0000000000c1', 'b0100000-0000-4000-8000-000000000012', 'b1200000-0000-4000-8000-000000000003',
        'b0100000-0000-4000-8000-000000000033', 'Pending'),
       ('b1200000-0000-4000-8000-0000000000d1', 'b0100000-0000-4000-8000-000000000014', 'b1200000-0000-4000-8000-000000000003',
        'b0100000-0000-4000-8000-000000000033', 'Pending'),
       ('b1200000-0000-4000-8000-0000000000e1', 'b0100000-0000-4000-8000-000000000012', 'b1200000-0000-4000-8000-000000000004',
        'b0100000-0000-4000-8000-000000000033', 'Pending'),
       ('b1200000-0000-4000-8000-0000000000f1', 'b0100000-0000-4000-8000-000000000014', 'b1200000-0000-4000-8000-000000000004',
        'b0100000-0000-4000-8000-000000000033', 'Pending'),
       ('b1200000-0000-4000-8000-000000000091', 'b0100000-0000-4000-8000-000000000012', 'b1200000-0000-4000-8000-000000000002',
        'b0100000-0000-4000-8000-000000000033', 'Pending');
update public.bookings set expires_at = now() - interval '1 hour' where id = 'b1200000-0000-4000-8000-000000000091';
update public.bookings set expires_at = now() - interval '1 minute' where id = 'b1200000-0000-4000-8000-0000000000f1';
insert into public.bookings (id, user_id, course_session_id, material_type_id, booking_status)
values ('b1200000-0000-4000-8000-000000000092', 'b0100000-0000-4000-8000-000000000014', 'b1200000-0000-4000-8000-000000000002',
        'b0100000-0000-4000-8000-000000000033', 'Pending');
update public.bookings set expires_at = now() - interval '1 hour', booking_status = 'Expired'
where id = 'b1200000-0000-4000-8000-0000000000e1';

insert into public.payment_attempts (id, booking_id, reference, amount, expires_at, status, ozow_payment_id, redirect_url)
select a.id, b.id, a.reference, b.total_amount, coalesce(a.expires_at, b.expires_at), a.status, a.payment, 'https://pay.example.test/' || a.payment
from (values
  ('b1200000-0000-4000-8000-0000000001a1'::uuid, 'b1200000-0000-4000-8000-0000000000a1'::uuid, 'DAB12A1', 'open', 'pay-a', null::timestamptz),
  ('b1200000-0000-4000-8000-0000000001b1'::uuid, 'b1200000-0000-4000-8000-0000000000b1'::uuid, 'DAB12B1', 'open', 'pay-b', null),
  ('b1200000-0000-4000-8000-0000000001c1'::uuid, 'b1200000-0000-4000-8000-0000000000c1'::uuid, 'DAB12C1', 'open', 'pay-c', null),
  ('b1200000-0000-4000-8000-0000000001d1'::uuid, 'b1200000-0000-4000-8000-0000000000d1'::uuid, 'DAB12D1', 'open', 'pay-d', null),
  ('b1200000-0000-4000-8000-0000000001e1'::uuid, 'b1200000-0000-4000-8000-0000000000e1'::uuid, 'DAB12E1', 'failed', 'pay-e', null),
  ('b1200000-0000-4000-8000-0000000001f1'::uuid, 'b1200000-0000-4000-8000-0000000000f1'::uuid, 'DAB12F1', 'open', 'pay-f', null),
  ('b1200000-0000-4000-8000-000000000191'::uuid, 'b1200000-0000-4000-8000-000000000091'::uuid, 'DAB12L1', 'open', 'pay-l', null)
) as a(id, booking, reference, status, payment, expires_at)
join public.bookings b on b.id = a.booking;

select ok((select relrowsecurity from pg_class where oid = 'public.payment_events'::regclass), 'payment events have row level security');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0100000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select throws_ok($$select public.settle_payment_attempt('pay-a', '[]')$$, '42501', null,
  'a student cannot settle a payment');
select is((select count(*)::int from public.payment_events), 0, 'a student reads no payment events');
reset role;
set local role anon;
select throws_ok($$select public.settle_payment_attempt('pay-a', '[]')$$, '42501', null, 'anon cannot settle a payment');
reset role;

set local role service_role;

select is(pg_temp.settle('pay-a', jsonb_build_array(pg_temp.tx('tx-a1', 'DAB12A1', '100', 'Incomplete'))), 'unchanged',
  'a payment still in progress changes nothing');
select results_eq(
  $$select b.booking_status, a.status from public.bookings b join public.payment_attempts a on a.booking_id = b.id
    where b.id = 'b1200000-0000-4000-8000-0000000000a1'$$,
  $$values ('Pending', 'open')$$,
  'the booking stays held while Ozow reports Incomplete');

select is(pg_temp.settle('pay-a', jsonb_build_array(pg_temp.tx('tx-a1', 'DAB12A1', '100.00', 'Successful'))), 'paid',
  'a matching successful transaction pays the attempt');
select results_eq(
  $$select b.booking_status, a.status from public.bookings b join public.payment_attempts a on a.booking_id = b.id
    where b.id = 'b1200000-0000-4000-8000-0000000000a1'$$,
  $$values ('Confirmed', 'paid')$$,
  'the held booking is confirmed and the attempt paid');
select results_eq(
  $$select p.amount, p.ozow_transaction_id, ps.name from public.payments p join public.payment_statuses ps on ps.id = p.payment_status_id
    where p.booking_id = 'b1200000-0000-4000-8000-0000000000a1'$$,
  $$values (100.00::numeric(10,2), 'tx-a1', 'Paid')$$,
  'one Paid payment for the stored total, keyed to Ozow''s transaction');
select results_eq(
  $$select ozow_transaction_id, ozow_status, outcome from public.payment_events
    where payment_attempt_id = 'b1200000-0000-4000-8000-0000000001a1' order by recorded_at, ozow_status$$,
  $$values ('tx-a1', 'Incomplete', 'noted'), ('tx-a1', 'Successful', 'paid')$$,
  'each transaction status Ozow reported is logged once');

select is(pg_temp.settle('pay-a', jsonb_build_array(pg_temp.tx('tx-a1', 'DAB12A1', '100.00', 'Successful'))), 'unchanged',
  'the same successful transaction again changes nothing');
select is(pg_temp.paid_count('b1200000-0000-4000-8000-0000000000a1'), 1, 'a duplicate adds no second payment');
select is((select count(*)::int from public.payment_events where ozow_transaction_id = 'tx-a1' and ozow_status = 'Successful'), 1,
  'a duplicate adds no second event');

select is(pg_temp.settle('pay-a', jsonb_build_array(
    pg_temp.tx('tx-a1', 'DAB12A1', '100.00', 'Error'), pg_temp.tx('tx-a2', 'DAB12A1', '100.00', 'Error'))), 'unchanged',
  'failures reported after the payment change nothing');
select results_eq(
  $$select b.booking_status, a.status from public.bookings b join public.payment_attempts a on a.booking_id = b.id
    where b.id = 'b1200000-0000-4000-8000-0000000000a1'$$,
  $$values ('Confirmed', 'paid')$$,
  'a stale failure cannot undo the payment');
select is((select array_agg(outcome order by ozow_transaction_id) from public.payment_events
           where payment_attempt_id = 'b1200000-0000-4000-8000-0000000001a1' and ozow_status = 'Error'),
  array['stale', 'stale'], 'stale failures are logged as stale');
select is(pg_temp.paid_count('b1200000-0000-4000-8000-0000000000a1'), 1, 'the payment survives stale failures');

select is(pg_temp.settle('pay-b', jsonb_build_array(pg_temp.tx('tx-b1', 'DAB12B1', '1', 'Successful'))), 'mismatch',
  'a successful transaction for another amount is a mismatch');
select is(pg_temp.settle('pay-b', jsonb_build_array(pg_temp.tx('tx-b2', 'DAOTHER', '100', 'Successful'))), 'mismatch',
  'a successful transaction for another reference is a mismatch');
select is(pg_temp.settle('pay-b', jsonb_build_array(pg_temp.tx('tx-b3', 'DAB12B1', '100', 'Successful', 'USD'))), 'mismatch',
  'a successful transaction in another currency is a mismatch');
select is(pg_temp.settle('pay-b', jsonb_build_array(pg_temp.tx('tx-b4', 'DAB12B1', '"100.00"', 'Successful'))), 'mismatch',
  'an amount that is not a number is a mismatch');
select results_eq(
  $$select b.booking_status, a.status, public.holds_seat(b) from public.bookings b join public.payment_attempts a on a.booking_id = b.id
    where b.id = 'b1200000-0000-4000-8000-0000000000b1'$$,
  $$values ('Pending', 'open', true)$$,
  'mismatches leave the booking held and the attempt open');
select is(pg_temp.paid_count('b1200000-0000-4000-8000-0000000000b1'), 0, 'mismatches record no payment');
select is((select reason from public.booking_review_flags where booking_id = 'b1200000-0000-4000-8000-0000000000b1'), 'payment_mismatch',
  'a mismatched successful transaction is flagged for an admin');
select is((select count(*)::int from public.payment_events where payment_attempt_id = 'b1200000-0000-4000-8000-0000000001b1' and outcome = 'mismatch'), 4,
  'every mismatch is logged');

reset role;
update public.payment_attempts set amount = 1 where id = 'b1200000-0000-4000-8000-0000000001b1';
set local role service_role;
select is(pg_temp.settle('pay-b', jsonb_build_array(pg_temp.tx('tx-b5', 'DAB12B1', '1', 'Successful'))), 'mismatch',
  'an attempt whose amount differs from the booking''s stored total is a mismatch');
reset role;
update public.payment_attempts set amount = 100 where id = 'b1200000-0000-4000-8000-0000000001b1';
set local role service_role;

select throws_ok($$select public.settle_payment_attempt('pay-unknown', '[]')$$, 'P0002', null,
  'an Ozow payment that matches no attempt is refused');
select throws_ok($$select public.settle_payment_attempt('pay-b', '{}')$$, '22023', null,
  'transactions must be a list');

select is(pg_temp.settle('pay-d', jsonb_build_array(
    pg_temp.tx('tx-d1', 'DAB12D1', '100', 'Error'), pg_temp.tx('tx-d2', 'DAB12D1', '100', 'Incomplete'))), 'unchanged',
  'a failed transaction does not end the attempt while another is in progress');
select results_eq(
  $$select b.booking_status, a.status from public.bookings b join public.payment_attempts a on a.booking_id = b.id
    where b.id = 'b1200000-0000-4000-8000-0000000000d1'$$,
  $$values ('Pending', 'open')$$,
  'the seat stays held while the student is still paying');

select is((select public.seats_taken(cs) from public.course_sessions cs where id = 'b1200000-0000-4000-8000-000000000003'), 2,
  'two held seats before the failure');
select is(pg_temp.settle('pay-c', jsonb_build_array(pg_temp.tx('tx-c1', 'DAB12C1', '100', 'Error'))), 'failed',
  'a failed or cancelled transaction fails the attempt');
select results_eq(
  $$select b.booking_status, a.status, public.holds_seat(b) from public.bookings b join public.payment_attempts a on a.booking_id = b.id
    where b.id = 'b1200000-0000-4000-8000-0000000000c1'$$,
  $$values ('Expired', 'failed', false)$$,
  'the booking expires and gives up its seat');
select is((select public.seats_taken(cs) from public.course_sessions cs where id = 'b1200000-0000-4000-8000-000000000003'), 1,
  'the failed payment released one seat');
select is((select outcome from public.payment_events where ozow_transaction_id = 'tx-c1'), 'failed', 'the failure is logged');
select is(pg_temp.settle('pay-c', jsonb_build_array(pg_temp.tx('tx-c1', 'DAB12C1', '100', 'Error'))), 'unchanged',
  'the same failure again changes nothing');

select is(pg_temp.settle('pay-f', '[]'), 'failed', 'an attempt past its expiry with no transaction fails');
select is((select booking_status from public.bookings where id = 'b1200000-0000-4000-8000-0000000000f1'), 'Expired',
  'its booking, whose hold lapsed with it, expires');
select is(pg_temp.settle('pay-b', '[]'), 'unchanged', 'an attempt still within its expiry with no transaction stays open');

select is(pg_temp.settle('pay-e', jsonb_build_array(pg_temp.tx('tx-e1', 'DAB12E1', '100', 'Successful'))), 'late_paid',
  'money on a failed attempt after the hold lapsed takes a free seat');
select results_eq(
  $$select b.booking_status, a.status from public.bookings b join public.payment_attempts a on a.booking_id = b.id
    where b.id = 'b1200000-0000-4000-8000-0000000000e1'$$,
  $$values ('Confirmed', 'paid')$$,
  'the late payment confirms the booking');
select is(pg_temp.paid_count('b1200000-0000-4000-8000-0000000000e1'), 1, 'the late payment is recorded');

select is(pg_temp.settle('pay-l', jsonb_build_array(pg_temp.tx('tx-l1', 'DAB12L1', '100', 'Successful'))), 'review',
  'a late payment for a class whose last seat went to someone else goes to review');
select results_eq(
  $$select b.booking_status, a.status, public.holds_seat(b) from public.bookings b join public.payment_attempts a on a.booking_id = b.id
    where b.id = 'b1200000-0000-4000-8000-000000000091'$$,
  $$values ('Pending', 'paid', false)$$,
  'the booking does not take a seat');
select is((select public.seats_taken(cs) from public.course_sessions cs where id = 'b1200000-0000-4000-8000-000000000002'), 1,
  'the one-seat class is not oversold');
select is(pg_temp.paid_count('b1200000-0000-4000-8000-000000000091'), 1, 'the money is still recorded');
select is((select reason from public.booking_review_flags where booking_id = 'b1200000-0000-4000-8000-000000000091'), 'late_payment',
  'the booking is flagged for an admin as a late payment');

reset role;
insert into public.payment_attempts (id, booking_id, reference, amount, expires_at, status, ozow_payment_id, redirect_url)
select 'b1200000-0000-4000-8000-0000000002a1', id, 'DAB12A2', total_amount, expires_at, 'failed', 'pay-a2', 'https://pay.example.test/pay-a2'
from public.bookings where id = 'b1200000-0000-4000-8000-0000000000a1';
set local role service_role;
select is(pg_temp.settle('pay-a2', jsonb_build_array(pg_temp.tx('tx-a3', 'DAB12A2', '100', 'Successful'))), 'review',
  'a second payment for a booking that is already paid goes to review');
select is(pg_temp.paid_count('b1200000-0000-4000-8000-0000000000a1'), 2, 'the second payment is recorded, not dropped');
select is((select reason from public.booking_review_flags where booking_id = 'b1200000-0000-4000-8000-0000000000a1'), 'duplicate_payment',
  'the booking is flagged for an admin as paid twice');

select throws_ok($$insert into public.payment_events (payment_attempt_id, ozow_transaction_id, ozow_status, outcome, transaction)
  values ('b1200000-0000-4000-8000-0000000001b1', 'tx-forged', 'Successful', 'paid', '{}')$$, '42501', null,
  'the service role cannot write payment events directly');
reset role;
select throws_ok($$update public.payment_events set outcome = 'noted' where ozow_transaction_id = 'tx-a1'$$, '42501', null,
  'payment events cannot be changed');
select throws_ok($$delete from public.payment_events where ozow_transaction_id = 'tx-a1'$$, '42501', null,
  'payment events cannot be deleted');

insert into public.course_sessions (id, course_id, location_id, start_date, end_date, start_time, end_time, max_students)
values ('b1200000-0000-4000-8000-000000000005', 'b0100000-0000-4000-8000-000000000023', 'b0100000-0000-4000-8000-000000000022',
        current_date + 84, current_date + 84, '09:00', '12:00', 10);
insert into public.bookings (id, user_id, course_session_id, material_type_id, booking_status)
values ('b1200000-0000-4000-8000-0000000000a5', 'b0100000-0000-4000-8000-000000000012', 'b1200000-0000-4000-8000-000000000005',
        'b0100000-0000-4000-8000-000000000033', 'Pending');
create temporary table begun (label text primary key, attempt public.payment_attempts) on commit drop;
grant all on begun to service_role;

set local role service_role;
insert into begun select 'first', public.begin_payment_attempt('b1200000-0000-4000-8000-0000000000a5', 'b0100000-0000-4000-8000-000000000012');
insert into begun select 'again', public.begin_payment_attempt('b1200000-0000-4000-8000-0000000000a5', 'b0100000-0000-4000-8000-000000000012');
select is((select (attempt).id from begun where label = 'again'), (select (attempt).id from begun where label = 'first'),
  'an open attempt that matches the hold is reused');
reset role;
update public.bookings set expires_at = now() + interval '48 hours' where id = 'b1200000-0000-4000-8000-0000000000a5';
set local role service_role;
insert into begun select 'renewed', public.begin_payment_attempt('b1200000-0000-4000-8000-0000000000a5', 'b0100000-0000-4000-8000-000000000012');
select isnt((select (attempt).id from begun where label = 'renewed'), (select (attempt).id from begun where label = 'first'),
  'a renewed hold gets a new attempt');
select results_eq(
  $$select status, expires_at = (select expires_at from public.bookings where id = 'b1200000-0000-4000-8000-0000000000a5')
    from public.payment_attempts where booking_id = 'b1200000-0000-4000-8000-0000000000a5' order by created_at, status$$,
  $$values ('failed', false), ('open', true)$$,
  'the stale attempt is failed and the new one carries the current hold expiry');
reset role;
update public.payment_attempts set amount = 1 where booking_id = 'b1200000-0000-4000-8000-0000000000a5' and status = 'open';
set local role service_role;
insert into begun select 'repriced', public.begin_payment_attempt('b1200000-0000-4000-8000-0000000000a5', 'b0100000-0000-4000-8000-000000000012');
select is((select (attempt).amount from begun where label = 'repriced'), 100.00::numeric(10,2),
  'an open attempt for another amount is replaced by one for the stored total');
select is((select count(*)::int from public.payment_attempts where booking_id = 'b1200000-0000-4000-8000-0000000000a5' and status = 'open'), 1,
  'still one open attempt');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0100000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select ok((select count(*) from public.payment_attempts where booking_id in (
    'b1200000-0000-4000-8000-0000000000a1', 'b1200000-0000-4000-8000-0000000000b1')) = 3,
  'an admin reads every student''s payment attempts');
select ok((select count(*) from public.payment_events) > 0, 'an admin reads payment events');
select throws_ok($$update public.payment_attempts set status = 'paid'$$, '42501', null, 'an admin cannot change payment attempts');
select throws_ok($$insert into public.payment_events (payment_attempt_id, ozow_transaction_id, ozow_status, outcome, transaction)
  values ('b1200000-0000-4000-8000-0000000001b1', 'tx-admin', 'Successful', 'paid', '{}')$$, '42501', null, 'an admin cannot write payment events');
reset role;

select is(public.request_payment_reconciliation(), null, 'reconciliation does nothing until its Vault secrets exist');
select is((select schedule from cron.job where jobname = 'reconcile-ozow-payments'), '*/10 * * * *',
  'reconciliation is scheduled every ten minutes');

select * from finish();
rollback;
