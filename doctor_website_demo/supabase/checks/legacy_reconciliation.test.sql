begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(10);

select results_eq(
  $$select id::text, course_session_id::text, booking_status from public.bookings
    where id::text like 'c0300000-%' order by id$$,
  $$values
    ('c0300000-0000-4000-8000-0000000000c1', 'c0300000-0000-4000-8000-0000000000b1', 'Confirmed'),
    ('c0300000-0000-4000-8000-0000000000c2', null, 'Pending'),
    ('c0300000-0000-4000-8000-0000000000c3', null, 'Pending'),
    ('c0300000-0000-4000-8000-0000000000c4', 'c0300000-0000-4000-8000-0000000000b1', 'Pending'),
    ('c0300000-0000-4000-8000-0000000000c5', null, 'Pending'),
    ('c0300000-0000-4000-8000-0000000000c6', null, 'Pending')$$,
  'single-session courses are remapped, everything else is unlinked but kept');

select results_eq(
  $$select booking_id::text, reason from public.booking_review_flags order by booking_id, reason$$,
  $$values
    ('c0300000-0000-4000-8000-0000000000c2', 'ambiguous_session'),
    ('c0300000-0000-4000-8000-0000000000c3', 'ambiguous_session'),
    ('c0300000-0000-4000-8000-0000000000c4', 'unverified_payment_status'),
    ('c0300000-0000-4000-8000-0000000000c5', 'duplicate_active_booking'),
    ('c0300000-0000-4000-8000-0000000000c5', 'unverified_payment_status'),
    ('c0300000-0000-4000-8000-0000000000c6', 'ambiguous_session'),
    ('c0300000-0000-4000-8000-0000000000c6', 'unverified_payment_status')$$,
  'every booking the migration could not resolve is flagged for review');

select is(
  (select details from public.booking_review_flags where booking_id = 'c0300000-0000-4000-8000-0000000000c2'),
  '{"legacy_course_session_id": "c0300000-0000-4000-8000-0000000000a2", "candidate_session_ids": ["c0300000-0000-4000-8000-0000000000b2", "c0300000-0000-4000-8000-0000000000b3"]}'::jsonb,
  'an ambiguous flag keeps the legacy course id and lists the candidate sessions');

select is(
  (select details from public.booking_review_flags where booking_id = 'c0300000-0000-4000-8000-0000000000c3'),
  '{"legacy_course_session_id": "c0300000-0000-4000-8000-0000000000a3", "candidate_session_ids": []}'::jsonb,
  'a course with no sessions is flagged with no candidates');

select is(
  (select details from public.booking_review_flags where booking_id = 'c0300000-0000-4000-8000-0000000000c5' and reason = 'duplicate_active_booking'),
  '{"legacy_course_session_id": "c0300000-0000-4000-8000-0000000000b1", "kept_booking_id": "c0300000-0000-4000-8000-0000000000c4"}'::jsonb,
  'the later duplicate is unlinked and points at the booking that kept the session');

select is(
  (select details from public.booking_review_flags where booking_id = 'c0300000-0000-4000-8000-0000000000c4' and reason = 'unverified_payment_status'),
  '{"legacy_payment_status": "passed", "payment_ids": []}'::jsonb,
  'a legacy payment status with no payment evidence is preserved in the flag');

select is(
  (select details from public.booking_review_flags where booking_id = 'c0300000-0000-4000-8000-0000000000c6' and reason = 'unverified_payment_status'),
  '{"legacy_payment_status": "paid", "payment_ids": ["c0300000-0000-4000-8000-0000000000d6"]}'::jsonb,
  'a paid label backed only by a payment with no status is flagged with that payment');

select is(
  (select count(*)::int from public.payments where booking_id::text like 'c0300000-%')
    + (select count(*)::int from public.certificates where booking_id::text like 'c0300000-%'),
  3,
  'payments and certificates stay attached to their bookings');

select throws_ok(
  $$update public.bookings set booking_status = 'Cancelled' where id = 'c0300000-0000-4000-8000-0000000000c2'$$,
  '23514', null, 'a flagged booking must be linked to a session before it changes');

select lives_ok(
  $$update public.bookings set course_session_id = 'c0300000-0000-4000-8000-0000000000b3' where id = 'c0300000-0000-4000-8000-0000000000c2'$$,
  'a reviewer can link a flagged booking to one of its candidate sessions');

select * from finish();
rollback;
