-- Run once in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/fwgwgeehrronfqilkdha/sql/new
--
-- Lets an instructor be limited to specific courses. Confirm email can stay on.

insert into public.roles (name)
select 'instructor'
where not exists (
  select 1 from public.roles where lower(name) = 'instructor'
);

create table if not exists public.instructor_courses (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.instructors (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (instructor_id, course_id)
);

alter table public.instructor_courses enable row level security;

drop policy if exists instructor_courses_select_authenticated on public.instructor_courses;
drop policy if exists instructor_courses_write_authenticated on public.instructor_courses;

create policy instructor_courses_select_authenticated
  on public.instructor_courses
  for select
  to authenticated
  using (true);

create policy instructor_courses_write_authenticated
  on public.instructor_courses
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.instructor_courses to authenticated;
grant select, insert, update, delete on public.instructor_courses to service_role;
