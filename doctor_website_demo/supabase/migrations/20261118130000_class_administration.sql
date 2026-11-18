insert into public.booking_statuses (name)
values ('Class Cancelled')
on conflict (name) do nothing;

create function public.booking_holds_seat(p_booking_status text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_booking_status in ('Pending', 'Confirmed', 'Completed');
$$;

alter table public.course_sessions
  add column status text not null default 'scheduled',
  add column cancelled_at timestamptz,
  add column cancellation_reason text,
  add column rescheduled_at timestamptz;

create table public.course_session_changes (
  id uuid primary key default gen_random_uuid(),
  course_session_id uuid not null references public.course_sessions (id),
  change text not null check (change in ('rescheduled', 'cancelled')),
  previous jsonb not null,
  current jsonb not null,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

create index course_session_changes_course_session_id_idx on public.course_session_changes (course_session_id);

alter table public.course_session_changes enable row level security;
revoke all on table public.course_session_changes from public, anon, authenticated;

insert into public.course_session_changes (course_session_id, change, previous, current)
select cs.id, 'cancelled',
       jsonb_build_object(
         'active', false,
         'bookings', coalesce(
           (select jsonb_agg(jsonb_build_object('booking_id', b.id, 'booking_status', b.booking_status) order by b.id)
            from public.bookings b
            where b.course_session_id = cs.id and public.booking_holds_seat(b.booking_status)),
           '[]'::jsonb)),
       jsonb_build_object('status', 'cancelled', 'reason', 'Inactive before class scheduling was introduced')
from public.course_sessions cs
where not cs.active;

update public.bookings b
set booking_status = 'Class Cancelled'
from public.course_sessions cs
where cs.id = b.course_session_id
  and not cs.active
  and public.booking_holds_seat(b.booking_status);

update public.course_sessions
set status = 'cancelled',
    cancelled_at = now(),
    cancellation_reason = 'Inactive before class scheduling was introduced'
where not active;

alter table public.course_sessions drop column active;

alter table public.course_sessions
  add constraint course_sessions_status_check check (status in ('scheduled', 'cancelled')),
  add constraint course_sessions_cancelled_at_check check ((status = 'cancelled') = (cancelled_at is not null)),
  add constraint course_sessions_date_range_check check (end_date >= start_date),
  add constraint course_sessions_time_range_check check (end_time > start_time),
  add constraint course_sessions_capacity_check check (max_students > 0);

alter table public.locations
  add constraint locations_name_not_blank check (btrim(name) <> '');

create unique index locations_name_key on public.locations (lower(btrim(name)));

create function public.check_course_session_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_taken integer;
begin
  if old.status = 'cancelled' and new is distinct from old then
    raise exception 'Class % is cancelled and cannot be changed', old.id using errcode = 'check_violation';
  end if;

  if new.status = 'cancelled' or new.max_students < old.max_students then
    select count(*) into v_taken
    from public.bookings
    where course_session_id = new.id and public.booking_holds_seat(booking_status);

    if new.status = 'cancelled' and v_taken > 0 then
      raise exception 'Class % still has % active bookings', new.id, v_taken using errcode = 'check_violation';
    end if;
    if new.max_students < v_taken then
      raise exception 'Capacity % is below the % active bookings for this class', new.max_students, v_taken
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger check_course_session_update
  before update on public.course_sessions
  for each row execute function public.check_course_session_update();

create function public.check_booking_seat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_capacity integer;
  v_taken integer;
begin
  if new.course_session_id is null or not public.booking_holds_seat(new.booking_status) then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and old.course_session_id is not distinct from new.course_session_id
     and public.booking_holds_seat(old.booking_status) then
    return new;
  end if;

  select status, max_students into v_status, v_capacity
  from public.course_sessions
  where id = new.course_session_id
  for update;
  if not found then
    return new;
  end if;

  if v_status <> 'scheduled' then
    raise exception 'Class % is cancelled', new.course_session_id using errcode = 'check_violation';
  end if;

  select count(*) into v_taken
  from public.bookings
  where course_session_id = new.course_session_id
    and public.booking_holds_seat(booking_status)
    and id <> new.id;

  if v_taken >= v_capacity then
    raise exception 'Class % is full', new.course_session_id using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger check_booking_seat
  before insert or update on public.bookings
  for each row execute function public.check_booking_seat();

create function public.require_admin(p_action text)
returns void
language plpgsql
stable
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
    raise exception 'Only admins can %', p_action using errcode = 'insufficient_privilege';
  end if;
end;
$$;

create function public.schedule_class(
  p_course_id uuid,
  p_location_id uuid,
  p_start_date date,
  p_end_date date,
  p_start_time time,
  p_end_time time,
  p_max_students integer,
  p_instructor_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.require_admin('schedule classes');

  if p_start_date < current_date then
    raise exception 'A class cannot start in the past' using errcode = 'check_violation';
  end if;
  if coalesce(cardinality(p_instructor_ids), 0) = 0 then
    raise exception 'A class needs at least one instructor' using errcode = 'invalid_parameter_value';
  end if;

  insert into public.course_sessions (course_id, location_id, start_date, end_date, start_time, end_time, max_students)
  values (p_course_id, p_location_id, p_start_date, p_end_date, p_start_time, p_end_time, p_max_students)
  returning id into v_id;

  insert into public.session_instructors (course_session_id, instructor_id)
  select v_id, unnest(p_instructor_ids);

  return v_id;
end;
$$;

create function public.reschedule_class(
  p_course_session_id uuid,
  p_location_id uuid,
  p_start_date date,
  p_end_date date,
  p_start_time time,
  p_end_time time,
  p_max_students integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.course_sessions;
  v_moved boolean;
begin
  perform public.require_admin('reschedule classes');

  select * into v_old from public.course_sessions where id = p_course_session_id for update;
  if not found then
    raise exception 'Class % does not exist', p_course_session_id using errcode = 'no_data_found';
  end if;
  if v_old.status = 'cancelled' then
    raise exception 'Class % is cancelled and cannot be rescheduled', p_course_session_id using errcode = 'check_violation';
  end if;

  v_moved := (p_location_id, p_start_date, p_end_date, p_start_time, p_end_time)
    is distinct from (v_old.location_id, v_old.start_date, v_old.end_date, v_old.start_time, v_old.end_time);
  if not v_moved and p_max_students is not distinct from v_old.max_students then
    return;
  end if;
  if p_start_date is distinct from v_old.start_date and p_start_date < current_date then
    raise exception 'A class cannot be moved into the past' using errcode = 'check_violation';
  end if;

  update public.course_sessions
  set location_id = p_location_id,
      start_date = p_start_date,
      end_date = p_end_date,
      start_time = p_start_time,
      end_time = p_end_time,
      max_students = p_max_students,
      rescheduled_at = case when v_moved then now() else rescheduled_at end
  where id = p_course_session_id;

  insert into public.course_session_changes (course_session_id, change, previous, current, changed_by)
  values (
    p_course_session_id,
    'rescheduled',
    jsonb_build_object('location_id', v_old.location_id, 'start_date', v_old.start_date, 'end_date', v_old.end_date,
                       'start_time', v_old.start_time, 'end_time', v_old.end_time, 'max_students', v_old.max_students),
    jsonb_build_object('location_id', p_location_id, 'start_date', p_start_date, 'end_date', p_end_date,
                       'start_time', p_start_time, 'end_time', p_end_time, 'max_students', p_max_students),
    auth.uid());
end;
$$;

create function public.cancel_class(p_course_session_id uuid, p_reason text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.course_sessions;
  v_reason text := nullif(btrim(p_reason), '');
  v_bookings jsonb;
  v_cancelled integer;
begin
  perform public.require_admin('cancel classes');

  if v_reason is null then
    raise exception 'Give a reason for cancelling the class' using errcode = 'invalid_parameter_value';
  end if;

  select * into v_old from public.course_sessions where id = p_course_session_id for update;
  if not found then
    raise exception 'Class % does not exist', p_course_session_id using errcode = 'no_data_found';
  end if;
  if v_old.status = 'cancelled' then
    return 0;
  end if;
  if v_old.start_date < current_date then
    raise exception 'Class % has already started and cannot be cancelled', p_course_session_id using errcode = 'check_violation';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('booking_id', id, 'booking_status', booking_status) order by id), '[]'::jsonb)
  into v_bookings
  from (
    select id, booking_status
    from public.bookings
    where course_session_id = p_course_session_id and public.booking_holds_seat(booking_status)
    for update
  ) seats;

  update public.bookings
  set booking_status = 'Class Cancelled'
  where course_session_id = p_course_session_id and public.booking_holds_seat(booking_status);
  get diagnostics v_cancelled = row_count;

  update public.course_sessions
  set status = 'cancelled', cancelled_at = now(), cancellation_reason = v_reason
  where id = p_course_session_id;

  insert into public.course_session_changes (course_session_id, change, previous, current, changed_by)
  values (
    p_course_session_id,
    'cancelled',
    jsonb_build_object('status', v_old.status, 'bookings', v_bookings),
    jsonb_build_object('status', 'cancelled', 'reason', v_reason),
    auth.uid());

  return v_cancelled;
end;
$$;

revoke execute on function public.booking_holds_seat(text) from public, anon, authenticated;
revoke execute on function public.check_course_session_update() from public, anon, authenticated;
revoke execute on function public.check_booking_seat() from public, anon, authenticated;
revoke execute on function public.require_admin(text) from public, anon, authenticated;
revoke execute on function public.schedule_class(uuid, uuid, date, date, time, time, integer, uuid[]) from public, anon;
revoke execute on function public.reschedule_class(uuid, uuid, date, date, time, time, integer) from public, anon;
revoke execute on function public.cancel_class(uuid, text) from public, anon;
grant execute on function public.schedule_class(uuid, uuid, date, date, time, time, integer, uuid[]) to authenticated;
grant execute on function public.reschedule_class(uuid, uuid, date, date, time, time, integer) to authenticated;
grant execute on function public.cancel_class(uuid, text) to authenticated;
