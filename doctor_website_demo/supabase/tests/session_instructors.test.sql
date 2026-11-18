begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(26);

select hasnt_column('public', 'course_sessions', 'instructor_id', 'class instructors live only in session_instructors');
select col_is_pk('public', 'session_instructors', array['course_session_id', 'instructor_id']);
select fk_ok('public', 'session_instructors', 'course_session_id', 'public', 'course_sessions', 'id');
select fk_ok('public', 'session_instructors', 'instructor_id', 'public', 'instructors', 'id');

select is(
  (select array_agg(instructor_id order by instructor_id) from public.session_instructors
   where course_session_id = 'b0100000-0000-4000-8000-000000000025'),
  array['b0100000-0000-4000-8000-000000000021', 'b0100000-0000-4000-8000-000000000041']::uuid[],
  'the fixture class has two instructors');

delete from public.session_instructors
where course_session_id = 'b0100000-0000-4000-8000-000000000025'
  and instructor_id = 'b0100000-0000-4000-8000-000000000041';

select lives_ok(
  $$insert into public.session_instructors (course_session_id, instructor_id)
    values ('b0100000-0000-4000-8000-000000000025', 'b0100000-0000-4000-8000-000000000041')$$,
  'an active instructor authorized for the course can be assigned');

select throws_ok(
  $$insert into public.session_instructors (course_session_id, instructor_id)
    values ('b0100000-0000-4000-8000-000000000025', 'b0100000-0000-4000-8000-000000000041')$$,
  '23505', null, 'assigning the same instructor twice fails');

select throws_ok(
  $$insert into public.session_instructors (course_session_id, instructor_id)
    values ('b0100000-0000-4000-8000-000000000025', 'b0100000-0000-4000-8000-000000000042')$$,
  '23514', null, 'an instructor not authorized for the course cannot be assigned');

select throws_ok(
  $$insert into public.session_instructors (course_session_id, instructor_id)
    values ('b0100000-0000-4000-8000-000000000025', 'b0100000-0000-4000-8000-000000000043')$$,
  '23514', null, 'an inactive instructor cannot be assigned even when authorized');

select throws_ok(
  $$update public.session_instructors set instructor_id = 'b0100000-0000-4000-8000-000000000042'
    where instructor_id = 'b0100000-0000-4000-8000-000000000041'$$,
  '23514', null, 'moving an assignment to an unauthorized instructor fails');

select is_empty(
  'select * from public.stale_session_instructors',
  'no fixture assignment needs review');

update public.instructors set active = false where id = 'b0100000-0000-4000-8000-000000000041';
delete from public.instructor_courses
where instructor_id = 'b0100000-0000-4000-8000-000000000021'
  and course_id = 'b0100000-0000-4000-8000-000000000023';

select is(
  (select count(*)::int from public.session_instructors where course_session_id = 'b0100000-0000-4000-8000-000000000025'),
  2,
  'deactivation and revoked authorization keep existing assignments');

select results_eq(
  $$select instructor_id, reason from public.stale_session_instructors order by instructor_id$$,
  $$values ('b0100000-0000-4000-8000-000000000021'::uuid, 'not_authorized_for_course'),
           ('b0100000-0000-4000-8000-000000000041'::uuid, 'instructor_inactive')$$,
  'kept assignments that lost authorization are listed for review');

update public.instructors set active = true where id = 'b0100000-0000-4000-8000-000000000041';
insert into public.instructor_courses (instructor_id, course_id)
values ('b0100000-0000-4000-8000-000000000021', 'b0100000-0000-4000-8000-000000000023');

set local role anon;
select throws_ok(
  $$select public.set_session_instructors('b0100000-0000-4000-8000-000000000025', array['b0100000-0000-4000-8000-000000000021']::uuid[])$$,
  '42501', null, 'anonymous callers cannot change class instructors');
select throws_ok('select * from public.session_instructors', '42501', null, 'anonymous visitors cannot read class instructors');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0100000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select throws_ok(
  $$select public.set_session_instructors('b0100000-0000-4000-8000-000000000025', array['b0100000-0000-4000-8000-000000000021']::uuid[])$$,
  '42501', null, 'a student cannot change class instructors');
select isnt_empty('select * from public.session_instructors', 'signed-in users can read class instructors');
select throws_ok(
  $$insert into public.session_instructors (course_session_id, instructor_id)
    values ('b0100000-0000-4000-8000-000000000025', 'b0100000-0000-4000-8000-000000000044')$$,
  '42501', null, 'signed-in users cannot write assignments directly');

select set_config('request.jwt.claims', '{"sub":"b0100000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select lives_ok(
  $$select public.set_session_instructors('b0100000-0000-4000-8000-000000000025',
      array['b0100000-0000-4000-8000-000000000041', 'b0100000-0000-4000-8000-000000000044']::uuid[])$$,
  'an admin replaces the class instructors in one call');
reset role;

select is(
  (select array_agg(instructor_id order by instructor_id) from public.session_instructors
   where course_session_id = 'b0100000-0000-4000-8000-000000000025'),
  array['b0100000-0000-4000-8000-000000000041', 'b0100000-0000-4000-8000-000000000044']::uuid[],
  'the class now has exactly the instructors the admin chose');

set local role authenticated;
select throws_ok(
  $$select public.set_session_instructors('b0100000-0000-4000-8000-000000000025',
      array['b0100000-0000-4000-8000-000000000021', 'b0100000-0000-4000-8000-000000000042']::uuid[])$$,
  '23514', null, 'a set with one unauthorized instructor fails');
select throws_ok(
  $$select public.set_session_instructors('b0100000-0000-4000-8000-000000000025',
      array['b0100000-0000-4000-8000-000000000021', 'b0100000-0000-4000-8000-000000000021']::uuid[])$$,
  '23505', null, 'a set naming an instructor twice fails');
select throws_ok(
  $$select public.set_session_instructors('b0100000-0000-4000-8000-000000000025', array[]::uuid[])$$,
  '22023', null, 'a class keeps at least one instructor');
select throws_ok(
  $$select public.set_session_instructors('b0100000-0000-4000-8000-0000000000ff', array['b0100000-0000-4000-8000-000000000021']::uuid[])$$,
  'P0002', null, 'an unknown class is rejected');
reset role;

select is(
  (select array_agg(instructor_id order by instructor_id) from public.session_instructors
   where course_session_id = 'b0100000-0000-4000-8000-000000000025'),
  array['b0100000-0000-4000-8000-000000000041', 'b0100000-0000-4000-8000-000000000044']::uuid[],
  'a rejected change leaves the previous instructors in place');

select is(
  (select user_id from public.instructors where id = 'b0100000-0000-4000-8000-000000000021'),
  'b0100000-0000-4000-8000-000000000013'::uuid,
  'the fixture instructor is linked to its user account');

select * from finish();
rollback;
