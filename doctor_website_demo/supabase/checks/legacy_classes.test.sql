begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(4);

select results_eq(
  $$select id, status, cancelled_at is not null, cancellation_reason from public.course_sessions order by id$$,
  $$values ('c0700000-0000-4000-8000-0000000000b1'::uuid, 'scheduled', false, null::text),
           ('c0700000-0000-4000-8000-0000000000b2'::uuid, 'cancelled', true, 'Inactive before class scheduling was introduced'),
           ('c0700000-0000-4000-8000-0000000000b3'::uuid, 'cancelled', true, 'Inactive before class scheduling was introduced')$$,
  'active classes stay scheduled and inactive classes become cancelled');

select results_eq(
  $$select id, booking_status from public.bookings order by id$$,
  $$values ('c0700000-0000-4000-8000-0000000000c1'::uuid, 'Confirmed'),
           ('c0700000-0000-4000-8000-0000000000c2'::uuid, 'Class Cancelled'),
           ('c0700000-0000-4000-8000-0000000000c3'::uuid, 'Cancelled')$$,
  'active bookings on inactive classes are marked Class Cancelled and other bookings are untouched');

select results_eq(
  $$select course_session_id, change, previous->'bookings' from public.course_session_changes order by course_session_id$$,
  $$values ('c0700000-0000-4000-8000-0000000000b2'::uuid, 'cancelled', '[{"booking_id": "c0700000-0000-4000-8000-0000000000c2", "booking_status": "Confirmed"}]'::jsonb),
           ('c0700000-0000-4000-8000-0000000000b3'::uuid, 'cancelled', '[]'::jsonb)$$,
  'each retired class logs the bookings it cancelled and their previous status');

select hasnt_column('public', 'course_sessions', 'active', 'the active flag is replaced by status');

select * from finish();
rollback;
