create function public.bookable(cs public.course_sessions)
returns boolean
language sql
stable
set search_path = ''
as $$
  select cs.status = 'scheduled'
     and cs.start_date >= current_date
     and public.seats_taken(cs) < cs.max_students
     and exists (select 1 from public.courses c where c.id = cs.course_id and c.active);
$$;

comment on function public.bookable(public.course_sessions) is
  'Whether reserve_seat would give a new student a seat in this class now.';

create function public.teaches_class(p_course_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.session_instructors si
    join public.instructors i on i.id = si.instructor_id
    join public.users u on u.id = i.user_id
    where si.course_session_id = p_course_session_id
      and i.user_id = auth.uid()
      and i.active
      and u.active);
$$;

alter table public.bookings enable row level security;
alter table public.payments enable row level security;

revoke all on table public.bookings, public.payments from anon;
revoke delete, truncate on table public.bookings from authenticated;
revoke insert, update, delete, truncate on table public.payments from authenticated;

create policy bookings_select_own on public.bookings
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy bookings_select_admin on public.bookings
  for select to authenticated
  using ((select public.is_admin()));

create policy bookings_select_instructor on public.bookings
  for select to authenticated
  using (public.teaches_class(course_session_id));

create policy bookings_insert_own_or_admin on public.bookings
  for insert to authenticated
  with check (user_id = (select auth.uid()) or (select public.is_admin()));

create policy bookings_update_own_or_admin on public.bookings
  for update to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()));

create policy payments_select_own on public.payments
  for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id and b.user_id = (select auth.uid())));

create policy payments_select_admin on public.payments
  for select to authenticated
  using ((select public.is_admin()));

revoke execute on function public.bookable(public.course_sessions) from public, anon;
revoke execute on function public.teaches_class(uuid) from public, anon;
grant execute on function public.bookable(public.course_sessions) to authenticated;
grant execute on function public.teaches_class(uuid) to authenticated;
