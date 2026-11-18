begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(69);

select ok((select relrowsecurity from pg_class where oid = 'public.refunds'::regclass), 'refunds have row level security');
select ok((select relrowsecurity from pg_class where oid = 'public.admin_audit_log'::regclass), 'the admin audit log has row level security');

insert into auth.users (id, email, aud, role)
values ('b1400000-0000-4000-8000-000000000001', 'third-student@example.test', 'authenticated', 'authenticated');
insert into public.users (id, role_id, first_name, last_name, birth_date, passport_num, cell_num, email, sanc_num)
values ('b1400000-0000-4000-8000-000000000001', '4fd9e72e-f94b-4222-b5c1-95b447088d4d', 'Fixture', 'Third Student',
        '1990-01-01', 'TEST-B14-STUDENT', '0000000141', 'third-student@example.test', 'TEST-STUDENT-3');

insert into public.course_sessions (id, course_id, location_id, start_date, end_date, start_time, end_time, max_students)
values ('b1400000-0000-4000-8000-000000000011', 'b0100000-0000-4000-8000-000000000023', 'b0100000-0000-4000-8000-000000000022',
        current_date + 15, current_date + 15, '09:00', '12:00', 10),
       ('b1400000-0000-4000-8000-000000000012', 'b0100000-0000-4000-8000-000000000023', 'b0100000-0000-4000-8000-000000000022',
        current_date + 5, current_date + 5, '09:00', '12:00', 10);

insert into public.bookings (id, user_id, course_session_id, material_type_id, booking_status)
values ('b1400000-0000-4000-8000-000000000021', 'b0100000-0000-4000-8000-000000000012', 'b1400000-0000-4000-8000-000000000011',
        'b0100000-0000-4000-8000-000000000061', 'Confirmed'),
       ('b1400000-0000-4000-8000-000000000022', 'b0100000-0000-4000-8000-000000000014', 'b1400000-0000-4000-8000-000000000011',
        'b0100000-0000-4000-8000-000000000061', 'Pending'),
       ('b1400000-0000-4000-8000-000000000023', 'b1400000-0000-4000-8000-000000000001', 'b1400000-0000-4000-8000-000000000011',
        'b0100000-0000-4000-8000-000000000061', 'Pending'),
       ('b1400000-0000-4000-8000-000000000024', 'b1400000-0000-4000-8000-000000000001', 'b1400000-0000-4000-8000-000000000012',
        'b0100000-0000-4000-8000-000000000033', 'Confirmed');
update public.bookings set expires_at = now() - interval '1 hour' where id = 'b1400000-0000-4000-8000-000000000023';

insert into public.payments (id, booking_id, amount, payment_date, payment_status_id)
select fixture.id, fixture.booking_id, fixture.amount, now(), ps.id
from (values
  ('b1400000-0000-4000-8000-000000000031'::uuid, 'b1400000-0000-4000-8000-000000000021'::uuid, 250.00),
  ('b1400000-0000-4000-8000-000000000032'::uuid, 'b1400000-0000-4000-8000-000000000024'::uuid, 100.00),
  ('b1400000-0000-4000-8000-000000000033'::uuid, 'b1400000-0000-4000-8000-000000000024'::uuid, 100.00)
) as fixture(id, booking_id, amount)
join public.payment_statuses ps on ps.name = 'Paid';

set local role anon;
select throws_ok('select * from public.refunds', '42501', null, 'anon cannot read refunds');
select throws_ok('select * from public.admin_audit_log', '42501', null, 'anon cannot read the admin audit log');
select throws_ok('select * from public.admin_booking_overview', '42501', null, 'anon cannot read the booking overview');
select throws_ok('select * from public.printed_material_demand', '42501', null, 'anon cannot read printed-material demand');
select throws_ok(
  $$select public.record_refund('b1400000-0000-4000-8000-000000000031', 10, 'r', 'ANON-1', true)$$,
  '42501', null, 'anon cannot record a refund');
select throws_ok(
  $$select public.resolve_review_flag('b0100000-0000-4000-8000-000000000101', 'n')$$,
  '42501', null, 'anon cannot resolve a review flag');
select throws_ok('select * from public.review_flags()', '42501', null, 'anon cannot read the review queue');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0100000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select throws_ok(
  $$select public.record_refund('b1400000-0000-4000-8000-000000000031', 10, 'r', 'STUDENT-1', true)$$,
  '42501', 'Only admins can record refunds', 'a student cannot record a refund, even on their own booking');
select throws_ok(
  $$select public.resolve_review_flag('b0100000-0000-4000-8000-000000000101', 'n')$$,
  '42501', null, 'a student cannot resolve a review flag');
select throws_ok('select * from public.review_flags()', '42501', null, 'a student cannot read the review queue');
select throws_ok('select * from public.booking_review_flags', '42501', null, 'signed-in users still have no direct access to review flags');
select is_empty('select id from public.admin_booking_overview', 'a student sees nothing in the booking overview');
select is_empty('select course_session_id from public.printed_material_demand', 'a student sees no printed-material demand');
select is_empty('select id from public.admin_audit_log', 'a student reads no audit entries');
select throws_ok(
  $$insert into public.refunds (booking_id, payment_id, refund_payment_id, amount, reason, external_reference, keeps_document_access, recorded_by)
    values ('b1400000-0000-4000-8000-000000000021', 'b1400000-0000-4000-8000-000000000031', 'b1400000-0000-4000-8000-000000000031',
            1, 'r', 'DIRECT-1', true, 'b0100000-0000-4000-8000-000000000012')$$,
  '42501', null, 'a student cannot write refunds directly');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0100000-0000-4000-8000-000000000013","role":"authenticated"}', true);
select throws_ok(
  $$select public.record_refund('b1400000-0000-4000-8000-000000000031', 10, 'r', 'INSTRUCTOR-1', true)$$,
  '42501', null, 'an instructor cannot record a refund');
select throws_ok(
  $$select public.resolve_review_flag('b0100000-0000-4000-8000-000000000101', 'n')$$,
  '42501', null, 'an instructor cannot resolve a review flag');
select throws_ok('select * from public.review_flags()', '42501', null, 'an instructor cannot read the review queue');
select is_empty('select id from public.admin_booking_overview', 'an instructor sees nothing in the booking overview');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0100000-0000-4000-8000-000000000011","role":"authenticated"}', true);

select results_eq(
  $$select booking_status, material_kind, paid_amount, refunded_amount, payment_state, student_email
    from public.admin_booking_overview where id = 'b1400000-0000-4000-8000-000000000021'$$,
  $$values ('Confirmed'::text, 'printed'::text, 250.00::numeric, 0::numeric, 'paid'::text, 'student@example.test'::text)$$,
  'the overview shows a paid printed booking with its student');
select results_eq(
  $$select id, payment_state from public.admin_booking_overview
    where id in ('b0100000-0000-4000-8000-000000000071', 'b0100000-0000-4000-8000-000000000037')
    order by id$$,
  $$values ('b0100000-0000-4000-8000-000000000037'::uuid, 'unpaid'::text), ('b0100000-0000-4000-8000-000000000071'::uuid, 'unpaid'::text)$$,
  'a failed payment or a refused attempt leaves a booking unpaid');
select is((select count(*)::int from public.admin_booking_overview), (select count(*)::int from public.bookings), 'the admin overview lists every booking');
select is(
  (select count(*)::int from public.admin_booking_overview where student_search like '%third%'),
  2, 'the overview can be searched by student name');

select results_eq(
  $$select confirmed, held, books_needed from public.printed_material_demand where course_session_id = 'b1400000-0000-4000-8000-000000000011'$$,
  $$values (1, 1, 2)$$,
  'printed demand counts the confirmed printed booking and the live printed hold, not the lapsed one');
select results_eq(
  $$select books_needed from public.printed_material_demand where course_session_id = 'b0100000-0000-4000-8000-000000000073'$$,
  $$values (1)$$,
  'the seeded printed hold counts; the electronic booking in the same class does not');
select is(
  (select books_needed from public.printed_material_demand where course_session_id = 'b1400000-0000-4000-8000-000000000012'),
  0, 'a class with only electronic bookings needs no printed books');
select is_empty(
  $$select 1 from public.printed_material_demand where course_session_id = 'b0100000-0000-4000-8000-000000000053'$$,
  'a cancelled class is not in the printed demand');

select throws_ok(
  $$select public.record_refund('b1400000-0000-4000-8000-000000000031', 250.01, 'Too much', 'OVER-1', true)$$,
  '23514', null, 'a refund above the payment is refused');
select throws_ok(
  $$select public.record_refund('b1400000-0000-4000-8000-000000000031', 0, 'Nothing', 'ZERO-1', true)$$,
  '22023', null, 'a zero refund is refused');
select throws_ok(
  $$select public.record_refund('b1400000-0000-4000-8000-000000000031', 1.234, 'Fractions', 'CENTS-1', true)$$,
  '22023', null, 'a refund in fractions of a cent is refused');
select throws_ok(
  $$select public.record_refund('b1400000-0000-4000-8000-000000000031', 10, '  ', 'BLANK-1', true)$$,
  '22023', 'Give the reason for this refund', 'a refund needs a reason');
select throws_ok(
  $$select public.record_refund('b1400000-0000-4000-8000-000000000031', 10, 'Reason', ' ', true)$$,
  '22023', 'Give the bank or Ozow reference of this refund', 'a refund needs a reference');
select throws_ok(
  $$select public.record_refund('b1400000-0000-4000-8000-000000000031', 10, 'Reason', 'NULL-1', null)$$,
  '22023', 'Decide whether the student keeps access to course documents', 'a refund needs an explicit document-access decision');
select throws_ok(
  $$select public.record_refund('b0100000-0000-4000-8000-000000000038', 10, 'Reason', 'FAILED-1', true)$$,
  '23514', null, 'a failed payment cannot be refunded');
select throws_ok(
  $$select public.record_refund('b1400000-0000-4000-8000-0000000000ff', 10, 'Reason', 'UNKNOWN-1', true)$$,
  'P0002', null, 'an unknown payment is refused');

select is(
  (select amount from public.record_refund('b1400000-0000-4000-8000-000000000031', 100, ' Printed books not needed ', ' RF-001 ', true)),
  100.00::numeric, 'a partial refund is recorded');
select results_eq(
  $$select reason, external_reference, keeps_document_access, recorded_by::text from public.refunds where booking_id = 'b1400000-0000-4000-8000-000000000021'$$,
  $$values ('Printed books not needed'::text, 'RF-001'::text, true, 'b0100000-0000-4000-8000-000000000011'::text)$$,
  'the refund keeps its trimmed reason, reference, decision and the admin who recorded it');
select results_eq(
  $$select p.amount, ps.name from public.payments p join public.payment_statuses ps on ps.id = p.payment_status_id
    where p.booking_id = 'b1400000-0000-4000-8000-000000000021' order by ps.name$$,
  $$values (250.00::numeric, 'Paid'::text), (100.00::numeric, 'Refunded'::text)$$,
  'the original Paid payment is unchanged and a Refunded payment sits beside it');
select results_eq(
  $$select booking_status, payment_state, refunded_amount, documents_withdrawn from public.admin_booking_overview where id = 'b1400000-0000-4000-8000-000000000021'$$,
  $$values ('Confirmed'::text, 'partly_refunded'::text, 100.00::numeric, false)$$,
  'a partial refund keeps the seat and shows partly refunded');

select is(
  (select id from public.record_refund('b1400000-0000-4000-8000-000000000031', 100, 'Printed books not needed', 'RF-001', true)),
  (select id from public.refunds where external_reference = 'RF-001'),
  'recording the same refund again returns the first record');
select is((select count(*)::int from public.refunds where external_reference = 'RF-001'), 1, 'the repeat adds no refund');
select is(
  (select count(*)::int from public.payments p join public.payment_statuses ps on ps.id = p.payment_status_id
   where p.booking_id = 'b1400000-0000-4000-8000-000000000021' and ps.name = 'Refunded'),
  1, 'the repeat adds no Refunded payment');
select throws_ok(
  $$select public.record_refund('b1400000-0000-4000-8000-000000000031', 50, 'Printed books not needed', 'RF-001', true)$$,
  '23505', null, 'a reference already used for a different refund is refused');
select throws_ok(
  $$select public.record_refund('b1400000-0000-4000-8000-000000000032', 100, 'Printed books not needed', 'rf-001 ', true)$$,
  '23505', null, 'a reference is unique across payments, whatever its case');
select throws_ok(
  $$select public.record_refund('b1400000-0000-4000-8000-000000000031', 150.01, 'Rest', 'RF-002', false)$$,
  '23514', null, 'refunding more than what is left on the payment is refused');

select is(
  (select amount from public.record_refund('b1400000-0000-4000-8000-000000000031', 150, 'Student withdrew', 'RF-002', false)),
  150.00::numeric, 'the rest of the payment is refunded');
select results_eq(
  $$select b.booking_status, public.holds_seat(b), o.payment_state, o.refunded_amount, o.documents_withdrawn
    from public.bookings b join public.admin_booking_overview o on o.id = b.id where b.id = 'b1400000-0000-4000-8000-000000000021'$$,
  $$values ('Cancelled'::text, false, 'refunded'::text, 250.00::numeric, true)$$,
  'a full refund cancels the booking, frees the seat and withdraws documents as decided');
select throws_ok(
  $$select public.record_refund('b1400000-0000-4000-8000-000000000031', 0.01, 'Again', 'RF-003', true)$$,
  '23514', null, 'nothing is left to refund on a fully refunded payment');
select is(
  (select confirmed from public.printed_material_demand where course_session_id = 'b1400000-0000-4000-8000-000000000011'),
  0, 'the refunded booking no longer counts towards printed books');

select lives_ok(
  $$select public.record_refund('b1400000-0000-4000-8000-000000000032', 100, 'Paid twice', 'RF-DUP', true)$$,
  'one of two duplicate payments is refunded');
select results_eq(
  $$select booking_status, payment_state, paid_amount, refunded_amount from public.admin_booking_overview where id = 'b1400000-0000-4000-8000-000000000024'$$,
  $$values ('Confirmed'::text, 'partly_refunded'::text, 200.00::numeric, 100.00::numeric)$$,
  'refunding a duplicate keeps the booking confirmed while one payment still covers it');

select lives_ok(
  $$select public.record_refund('b0100000-0000-4000-8000-000000000055', 100, 'Class cancelled by us', 'RF-CC', true)$$,
  'a Class Cancelled booking is refunded');
select results_eq(
  $$select booking_status, payment_state, documents_withdrawn from public.admin_booking_overview where id = 'b0100000-0000-4000-8000-000000000054'$$,
  $$values ('Class Cancelled'::text, 'refunded'::text, false)$$,
  'a refunded Class Cancelled booking keeps its status and the student keeps documents as decided');

select results_eq(
  $$select actor_id::text, booking_id::text, details->>'external_reference', details->>'booking_status_after'
    from public.admin_audit_log where action = 'record_refund' order by id$$,
  $$values ('b0100000-0000-4000-8000-000000000011', 'b1400000-0000-4000-8000-000000000021', 'RF-001', 'Confirmed'),
           ('b0100000-0000-4000-8000-000000000011', 'b1400000-0000-4000-8000-000000000021', 'RF-002', 'Cancelled'),
           ('b0100000-0000-4000-8000-000000000011', 'b1400000-0000-4000-8000-000000000024', 'RF-DUP', 'Confirmed'),
           ('b0100000-0000-4000-8000-000000000011', 'b0100000-0000-4000-8000-000000000054', 'RF-CC', 'Class Cancelled')$$,
  'every recorded refund, and only those, appends one audit entry');

select results_eq(
  $$select id::text, resolved_at is null from public.review_flags() where id in ('b0100000-0000-4000-8000-000000000101', 'b0100000-0000-4000-8000-000000000102') order by id$$,
  $$values ('b0100000-0000-4000-8000-000000000101', true), ('b0100000-0000-4000-8000-000000000102', false)$$,
  'an admin reads open and resolved review flags');
select throws_ok(
  $$select public.resolve_review_flag('b0100000-0000-4000-8000-000000000101', '  ')$$,
  '22023', null, 'resolving a flag needs a note');
select throws_ok(
  $$select public.resolve_review_flag('b1400000-0000-4000-8000-0000000000ff', 'note')$$,
  'P0002', null, 'an unknown flag is refused');
select results_eq(
  $$select resolved_at is not null, resolved_by::text, resolution_note
    from public.resolve_review_flag('b0100000-0000-4000-8000-000000000101', ' Ozow confirmed the R1 test transaction; nothing owed. ')$$,
  $$values (true, 'b0100000-0000-4000-8000-000000000011', 'Ozow confirmed the R1 test transaction; nothing owed.')$$,
  'an admin resolves a flag with a note');
select is(
  (select resolution_note from public.resolve_review_flag('b0100000-0000-4000-8000-000000000101', 'a different note')),
  'Ozow confirmed the R1 test transaction; nothing owed.', 'resolving it again changes nothing');
select results_eq(
  $$select booking_id::text, details->>'reason', details->>'note' from public.admin_audit_log where action = 'resolve_review_flag'$$,
  $$values ('b0100000-0000-4000-8000-000000000071', 'payment_mismatch', 'Ozow confirmed the R1 test transaction; nothing owed.')$$,
  'resolving a flag appends one audit entry');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0100000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select results_eq(
  $$select external_reference from public.refunds order by external_reference$$,
  $$values ('RF-001'::text), ('RF-002'::text), ('RF-CC'::text)$$,
  'a student reads the refunds on their own bookings');
select results_eq(
  $$select b.id, public.documents_withdrawn(b) from public.bookings b where b.id in ('b1400000-0000-4000-8000-000000000021', 'b0100000-0000-4000-8000-000000000054') order by id$$,
  $$values ('b0100000-0000-4000-8000-000000000054'::uuid, false), ('b1400000-0000-4000-8000-000000000021'::uuid, true)$$,
  'a student''s bookings say whether course documents were withdrawn');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1400000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is_empty($$select 1 from public.refunds where booking_id <> 'b1400000-0000-4000-8000-000000000024'$$,
  'a student reads no other student''s refunds');
reset role;

select throws_ok($$update public.refunds set amount = 1$$, '42501', null, 'refunds cannot be changed');
select throws_ok($$delete from public.refunds$$, '42501', null, 'refunds cannot be deleted');
select throws_ok($$delete from public.admin_audit_log$$, '42501', null, 'audit entries cannot be deleted');

insert into public.booking_review_flags (booking_id, reason, details)
values ('b0100000-0000-4000-8000-000000000071', 'payment_mismatch', '{"reference": "DAFIXTURE01", "amount": 2}')
on conflict (booking_id, reason) do nothing;
select results_eq(
  $$select count(*)::int, bool_and(resolved_at is null), bool_and(resolution_note is null), max(details->>'amount')
    from public.booking_review_flags where booking_id = 'b0100000-0000-4000-8000-000000000071' and reason = 'payment_mismatch'$$,
  $$values (1, true, true, '2')$$,
  'raising a resolved flag again reopens it with the new details');

select * from finish();
rollback;
