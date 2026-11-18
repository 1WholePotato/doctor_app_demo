begin;

insert into public.instructors (id, first_name, last_name, email, cell_num, active)
values ('c0300000-0000-4000-8000-000000000023', 'Legacy', 'Account', ' Legacy-One@Example.test', '0000000323', false);

update public.course_sessions
set instructor_id = 'c0300000-0000-4000-8000-000000000023'
where id = 'c0300000-0000-4000-8000-0000000000b3';

commit;
