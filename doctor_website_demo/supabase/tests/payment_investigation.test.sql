begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(37);

create function pg_temp.tx(p_id text, p_reference text, p_status text, p_reason text)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'id', p_id, 'merchantReference', p_reference, 'siteCode', 'MCK-MCK-001', 'institution', 'Fixture Bank',
    'amount', jsonb_build_object('currency', 'ZAR', 'value', 100), 'status', p_status, 'reason', p_reason,
    'createdDate', now(), 'completedDate', now());
$$;

create function pg_temp.settle(p_payment text, variadic p_transactions jsonb[])
returns text
language sql
as $$ select public.settle_payment_attempt(p_payment, to_jsonb(p_transactions)); $$;

create function pg_temp.state(p_booking uuid)
returns table (booking_status text, attempt_status text, holds_seat boolean)
language sql
as $$
  select b.booking_status, a.status, public.holds_seat(b)
  from public.bookings b join public.payment_attempts a on a.booking_id = b.id
  where b.id = p_booking;
$$;

create function pg_temp.paid_count(p_booking uuid)
returns integer
language sql
as $$
  select count(*)::integer from public.payments p join public.payment_statuses ps on ps.id = p.payment_status_id
  where p.booking_id = p_booking and ps.name = 'Paid';
$$;

create function pg_temp.seats(p_class uuid)
returns integer
language sql
as $$ select public.seats_taken(cs) from public.course_sessions cs where cs.id = p_class; $$;

select results_eq(
  $$select status, reason, public.ozow_transaction_effect(status, reason) from (values
      ('Incomplete', 'Created'), ('Successful', 'Complete'),
      ('Error', 'Cancelled'), ('Error', 'Abandoned'), ('Error', 'Voided'), ('Error', 'Error'),
      ('Pending', 'Pending'), ('Pending', 'PendingInvestigation'),
      ('Successful', null), ('Pending', null), ('Refunded', null), ('Settled', 'Complete')) as t(status, reason)$$,
  $$values ('Incomplete', 'Created', 'wait'), ('Successful', 'Complete', 'settle'),
      ('Error', 'Cancelled', 'fail'), ('Error', 'Abandoned', 'fail'), ('Error', 'Voided', 'fail'), ('Error', 'Error', 'fail'),
      ('Pending', 'Pending', 'wait'), ('Pending', 'PendingInvestigation', 'investigate'),
      ('Successful', null, 'settle'), ('Pending', null, 'wait'), ('Refunded', null, 'none'), ('Settled', 'Complete', 'none')$$,
  'every row of Ozow''s money-in status table maps to one effect, and an unknown status credits nothing');

insert into public.course_sessions (id, course_id, location_id, start_date, end_date, start_time, end_time, max_students)
select c.id, 'b0100000-0000-4000-8000-000000000023', 'b0100000-0000-4000-8000-000000000022', current_date + c.days, current_date + c.days,
       '09:00', '12:00', c.seats
from (values
  ('b1210000-0000-4000-8000-000000000001'::uuid, 90, 10),
  ('b1210000-0000-4000-8000-000000000002'::uuid, 91, 10),
  ('b1210000-0000-4000-8000-000000000003'::uuid, 92, 1),
  ('b1210000-0000-4000-8000-000000000004'::uuid, 93, 10)
) as c(id, days, seats);

insert into public.bookings (id, user_id, course_session_id, material_type_id, booking_status)
values ('b1210000-0000-4000-8000-0000000000a1', 'b0100000-0000-4000-8000-000000000012', 'b1210000-0000-4000-8000-000000000001',
        'b0100000-0000-4000-8000-000000000033', 'Pending'),
       ('b1210000-0000-4000-8000-0000000000b1', 'b0100000-0000-4000-8000-000000000014', 'b1210000-0000-4000-8000-000000000001',
        'b0100000-0000-4000-8000-000000000033', 'Pending'),
       ('b1210000-0000-4000-8000-0000000000a2', 'b0100000-0000-4000-8000-000000000014', 'b1210000-0000-4000-8000-000000000002',
        'b0100000-0000-4000-8000-000000000033', 'Pending'),
       ('b1210000-0000-4000-8000-0000000000a3', 'b0100000-0000-4000-8000-000000000012', 'b1210000-0000-4000-8000-000000000003',
        'b0100000-0000-4000-8000-000000000033', 'Pending'),
       ('b1210000-0000-4000-8000-0000000000a4', 'b0100000-0000-4000-8000-000000000012', 'b1210000-0000-4000-8000-000000000004',
        'b0100000-0000-4000-8000-000000000033', 'Pending'),
       ('b1210000-0000-4000-8000-0000000000b4', 'b0100000-0000-4000-8000-000000000014', 'b1210000-0000-4000-8000-000000000004',
        'b0100000-0000-4000-8000-000000000033', 'Pending');
update public.bookings set expires_at = now() - interval '1 hour' where id = 'b1210000-0000-4000-8000-0000000000a3';

insert into public.payment_attempts (id, booking_id, reference, amount, expires_at, ozow_payment_id, redirect_url)
select a.id, b.id, a.reference, b.total_amount, coalesce(a.expires_at, b.expires_at), a.payment, 'https://pay.example.test/' || a.payment
from (values
  ('b1210000-0000-4000-8000-0000000001a1'::uuid, 'b1210000-0000-4000-8000-0000000000a1'::uuid, 'DAB12IA1', 'pay-ia1', null::timestamptz),
  ('b1210000-0000-4000-8000-0000000001b1'::uuid, 'b1210000-0000-4000-8000-0000000000b1'::uuid, 'DAB12IB1', 'pay-ib1', null),
  ('b1210000-0000-4000-8000-0000000001a2'::uuid, 'b1210000-0000-4000-8000-0000000000a2'::uuid, 'DAB12IA2', 'pay-ia2', null),
  ('b1210000-0000-4000-8000-0000000001a3'::uuid, 'b1210000-0000-4000-8000-0000000000a3'::uuid, 'DAB12IA3', 'pay-ia3', null),
  ('b1210000-0000-4000-8000-0000000001a4'::uuid, 'b1210000-0000-4000-8000-0000000000a4'::uuid, 'DAB12IA4', 'pay-ia4', now() - interval '1 minute'),
  ('b1210000-0000-4000-8000-0000000001b4'::uuid, 'b1210000-0000-4000-8000-0000000000b4'::uuid, 'DAB12IB4', 'pay-ib4', now() + interval '1 hour')
) as a(id, booking, reference, payment, expires_at)
join public.bookings b on b.id = a.booking;

set local role service_role;

select is(pg_temp.settle('pay-ia1', pg_temp.tx('tx-ia1', 'DAB12IA1', 'Pending', 'Pending')), 'unchanged',
  'Pending/Pending is still in progress');
select is(pg_temp.settle('pay-ia1', pg_temp.tx('tx-ia1', 'DAB12IA1', 'Pending', 'PendingInvestigation')), 'investigating',
  'the same transaction moving to Pending/PendingInvestigation is a final outcome that needs an admin');
select results_eq($$select * from pg_temp.state('b1210000-0000-4000-8000-0000000000a1')$$,
  $$values ('Pending', 'investigating', true)$$,
  'the attempt is under investigation and the booking keeps its seat');
select is((select expires_at from public.bookings where id = 'b1210000-0000-4000-8000-0000000000a1'), null,
  'the hold no longer lapses while the bank investigates');
select is(pg_temp.paid_count('b1210000-0000-4000-8000-0000000000a1'), 0, 'an investigation credits no money');
reset role;
select results_eq(
  $$select reason, resolved_at is null, (details->>'seat_held')::boolean from public.booking_review_flags
    where booking_id = 'b1210000-0000-4000-8000-0000000000a1'$$,
  $$values ('payment_investigation', true, true)$$,
  'the booking is flagged for an admin to check the bank statement');
set local role service_role;
select results_eq(
  $$select ozow_status, ozow_reason, outcome from public.payment_events
    where payment_attempt_id = 'b1210000-0000-4000-8000-0000000001a1' order by recorded_at, ozow_reason$$,
  $$values ('Pending', 'Pending', 'noted'), ('Pending', 'PendingInvestigation', 'investigating')$$,
  'both reasons of the transaction are logged');
select is(pg_temp.settle('pay-ia1', pg_temp.tx('tx-ia1', 'DAB12IA1', 'Pending', 'PendingInvestigation')), 'unchanged',
  'the same investigation again changes nothing');
select is((select count(*)::int from public.payment_events where ozow_transaction_id = 'tx-ia1'), 2,
  'a repeated investigation adds no event');
select throws_ok(
  $$select public.begin_payment_attempt('b1210000-0000-4000-8000-0000000000a1', 'b0100000-0000-4000-8000-000000000012')$$,
  '23514', 'A payment on booking b1210000-0000-4000-8000-0000000000a1 is under investigation with the bank',
  'the student cannot start a second payment while the first is investigated');

select is(pg_temp.settle('pay-ia3', pg_temp.tx('tx-ia3', 'DAB12IA3', 'Pending', 'PendingInvestigation')), 'investigating',
  'an investigation reported after the hold lapsed is still flagged');
select results_eq($$select * from pg_temp.state('b1210000-0000-4000-8000-0000000000a3')$$,
  $$values ('Pending', 'investigating', false)$$,
  'a lapsed hold is not revived for an investigation');
reset role;
select results_eq(
  $$select reason, (details->>'seat_held')::boolean from public.booking_review_flags where booking_id = 'b1210000-0000-4000-8000-0000000000a3'$$,
  $$values ('payment_investigation', false)$$,
  'the flag tells the admin no seat is held');
set local role service_role;

reset role;
update public.payment_attempts set expires_at = now() - interval '1 minute' where id = 'b1210000-0000-4000-8000-0000000001a1';
select lives_ok('select public.expire_seat_holds()', 'the hold expiry job runs during the investigation');
set local role service_role;
select is(pg_temp.settle('pay-ia1', pg_temp.tx('tx-ia1', 'DAB12IA1', 'Pending', 'PendingInvestigation')), 'unchanged',
  'an investigated attempt past its own expiry is not failed');
select results_eq($$select * from pg_temp.state('b1210000-0000-4000-8000-0000000000a1')$$,
  $$values ('Pending', 'investigating', true)$$,
  'neither time nor the hold expiry job releases the seat during an investigation');

select is(pg_temp.settle('pay-ia1', pg_temp.tx('tx-ia1', 'DAB12IA1', 'Successful', 'Complete')), 'paid',
  'Ozow Support completing the investigation pays the held booking');
select results_eq($$select * from pg_temp.state('b1210000-0000-4000-8000-0000000000a1')$$,
  $$values ('Confirmed', 'paid', true)$$,
  'the booking is confirmed');
select is(pg_temp.paid_count('b1210000-0000-4000-8000-0000000000a1'), 1, 'the money is recorded once');
reset role;
select isnt((select resolved_at from public.booking_review_flags
             where booking_id = 'b1210000-0000-4000-8000-0000000000a1' and reason = 'payment_investigation'), null,
  'the investigation flag is resolved');
set local role service_role;

select is(pg_temp.seats('b1210000-0000-4000-8000-000000000002'), 1, 'one held seat before the investigation fails');
select is(pg_temp.settle('pay-ia2', pg_temp.tx('tx-ia2', 'DAB12IA2', 'Pending', 'PendingInvestigation')), 'investigating',
  'a second booking goes under investigation');
select is(pg_temp.settle('pay-ia2', pg_temp.tx('tx-ia2', 'DAB12IA2', 'Error', 'Error')), 'failed',
  'Ozow Support failing the investigation fails the attempt');
select results_eq($$select * from pg_temp.state('b1210000-0000-4000-8000-0000000000a2')$$,
  $$values ('Expired', 'failed', false)$$,
  'the booking expires');
select is(pg_temp.seats('b1210000-0000-4000-8000-000000000002'), 0, 'the seat held through the investigation is released');
select is(pg_temp.paid_count('b1210000-0000-4000-8000-0000000000a2'), 0, 'no money is recorded');
reset role;
select isnt((select resolved_at from public.booking_review_flags where booking_id = 'b1210000-0000-4000-8000-0000000000a2'), null,
  'the failed investigation resolves its flag');
set local role service_role;

select is(pg_temp.settle('pay-ib1', pg_temp.tx('tx-ib1', 'DAB12IB1', 'Refunded', 'Complete')), 'unchanged',
  'a refunded transaction credits nothing and changes nothing');
select results_eq($$select * from pg_temp.state('b1210000-0000-4000-8000-0000000000b1')$$,
  $$values ('Pending', 'open', true)$$,
  'the booking stays held after a refund report');
select is(pg_temp.settle('pay-ib1', pg_temp.tx('tx-ib1', 'DAB12IB1', 'Pending', null)), 'unchanged',
  'a Pending transaction without a reason is still in progress');

select is(pg_temp.settle('pay-ia4', variadic array[]::jsonb[]), 'failed',
  'an open attempt past its own expiry fails');
select results_eq($$select * from pg_temp.state('b1210000-0000-4000-8000-0000000000a4')$$,
  $$values ('Pending', 'failed', true)$$,
  'a booking whose hold outlives the attempt keeps its seat');
select is(pg_temp.settle('pay-ib4', pg_temp.tx('tx-ib4', 'DAB12IB4', 'Error', 'Cancelled')), 'failed',
  'a cancellation on an attempt for an older hold fails that attempt');
select results_eq($$select * from pg_temp.state('b1210000-0000-4000-8000-0000000000b4')$$,
  $$values ('Pending', 'failed', true)$$,
  'the booking''s current hold is kept');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0100000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select throws_ok($$select public.ozow_transaction_effect('Successful', 'Complete')$$, '42501', null,
  'students cannot call the status mapping');
select results_eq(
  $$select status from public.payment_attempts where id = 'b1210000-0000-4000-8000-0000000001a3'$$,
  $$values ('investigating')$$,
  'a student reads that their own payment is under investigation');
reset role;

select * from finish();
rollback;
