alter table public.instructors
  add column user_id uuid unique references public.users (id) on delete set null;

update public.instructors i
set user_id = u.id
from public.users u
where lower(btrim(u.email)) = lower(btrim(i.email))
  and (select count(*) from public.users u2 where lower(btrim(u2.email)) = lower(btrim(i.email))) = 1
  and (select count(*) from public.instructors i2 where lower(btrim(i2.email)) = lower(btrim(i.email))) = 1;

create table public.session_instructors (
  course_session_id uuid not null references public.course_sessions (id) on delete cascade,
  instructor_id uuid not null references public.instructors (id),
  primary key (course_session_id, instructor_id)
);

create index session_instructors_instructor_id_idx on public.session_instructors (instructor_id);

insert into public.session_instructors (course_session_id, instructor_id)
select id, instructor_id from public.course_sessions;

alter table public.course_sessions drop column instructor_id;

create function public.instructor_can_teach(p_instructor_id uuid, p_course_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.instructors i
    join public.instructor_courses ic on ic.instructor_id = i.id
    where i.id = p_instructor_id and i.active and ic.course_id = p_course_id);
$$;

create function public.check_session_instructor()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_course_id uuid;
begin
  select course_id into v_course_id from public.course_sessions where id = new.course_session_id;
  if v_course_id is null then
    return new;
  end if;

  perform 1 from public.instructors where id = new.instructor_id for share;
  perform 1 from public.instructor_courses
  where instructor_id = new.instructor_id and course_id = v_course_id
  for share;

  if not public.instructor_can_teach(new.instructor_id, v_course_id) then
    raise exception 'Instructor % is not active and authorized to teach this course', new.instructor_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger check_session_instructor
  before insert or update on public.session_instructors
  for each row execute function public.check_session_instructor();

create view public.stale_session_instructors
with (security_invoker = true)
as
select si.course_session_id, si.instructor_id, cs.course_id,
       case when i.active then 'not_authorized_for_course' else 'instructor_inactive' end as reason
from public.session_instructors si
join public.course_sessions cs on cs.id = si.course_session_id
join public.instructors i on i.id = si.instructor_id
where not public.instructor_can_teach(si.instructor_id, cs.course_id);

create function public.set_session_instructors(p_course_session_id uuid, p_instructor_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid() and u.active and r.name = 'admin'
  ) then
    raise exception 'Only admins can change class instructors' using errcode = 'insufficient_privilege';
  end if;

  if coalesce(cardinality(p_instructor_ids), 0) = 0 then
    raise exception 'A class needs at least one instructor' using errcode = 'invalid_parameter_value';
  end if;

  perform 1 from public.course_sessions where id = p_course_session_id for update;
  if not found then
    raise exception 'Class % does not exist', p_course_session_id using errcode = 'no_data_found';
  end if;

  delete from public.session_instructors where course_session_id = p_course_session_id;
  insert into public.session_instructors (course_session_id, instructor_id)
  select p_course_session_id, unnest(p_instructor_ids);
end;
$$;

alter table public.session_instructors enable row level security;
revoke all on table public.session_instructors from public, anon, authenticated;
grant select on table public.session_instructors to authenticated;
create policy session_instructors_select_authenticated on public.session_instructors
  for select to authenticated using (true);

revoke all on table public.stale_session_instructors from public, anon, authenticated;
grant select on table public.stale_session_instructors to service_role;

revoke execute on function public.instructor_can_teach(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.check_session_instructor() from public, anon, authenticated;
revoke execute on function public.set_session_instructors(uuid, uuid[]) from public, anon;
grant execute on function public.instructor_can_teach(uuid, uuid) to service_role;
grant execute on function public.set_session_instructors(uuid, uuid[]) to authenticated;
