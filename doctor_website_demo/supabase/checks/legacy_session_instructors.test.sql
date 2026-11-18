begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(4);

select results_eq(
  $$select course_session_id, instructor_id from public.session_instructors order by course_session_id$$,
  $$values ('c0300000-0000-4000-8000-0000000000b1'::uuid, 'c0300000-0000-4000-8000-000000000021'::uuid),
           ('c0300000-0000-4000-8000-0000000000b2'::uuid, 'c0300000-0000-4000-8000-000000000021'::uuid),
           ('c0300000-0000-4000-8000-0000000000b3'::uuid, 'c0300000-0000-4000-8000-000000000023'::uuid)$$,
  'every legacy class keeps its instructor');

select results_eq(
  $$select course_session_id, reason from public.stale_session_instructors order by course_session_id$$,
  $$values ('c0300000-0000-4000-8000-0000000000b1'::uuid, 'not_authorized_for_course'),
           ('c0300000-0000-4000-8000-0000000000b2'::uuid, 'not_authorized_for_course'),
           ('c0300000-0000-4000-8000-0000000000b3'::uuid, 'instructor_inactive')$$,
  'legacy assignments without a current authorization are listed for review');

select is(
  (select user_id from public.instructors where id = 'c0300000-0000-4000-8000-000000000023'),
  'c0300000-0000-4000-8000-000000000011'::uuid,
  'an instructor is linked to the user whose email matches ignoring case and spaces');

select is(
  (select user_id from public.instructors where id = 'c0300000-0000-4000-8000-000000000021'),
  null,
  'an instructor with no matching user stays unlinked');

select * from finish();
rollback;
