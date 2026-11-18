insert into public.booking_statuses (name)
values ('Expired')
on conflict (name) do nothing;

alter table public.bookings add column expires_at timestamptz;

comment on column public.bookings.expires_at is
  'When a Pending booking stops holding its seat. Null only on bookings made before seat holds existed, which keep their seat until an admin confirms or cancels them.';

create function public.holds_seat(b public.bookings)
returns boolean
language sql
stable
set search_path = ''
as $$
  select b.booking_status in ('Confirmed', 'Completed')
      or (b.booking_status = 'Pending' and (b.expires_at is null or b.expires_at > now()));
$$;

create function public.seats_taken(cs public.course_sessions)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.bookings b
  where b.course_session_id = cs.id and public.holds_seat(b);
$$;

create or replace function public.check_booking_seat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_capacity integer;
  v_taken integer;
  v_same_class boolean := tg_op = 'UPDATE' and old.course_session_id is not distinct from new.course_session_id;
begin
  if new.booking_status = 'Pending' and (tg_op = 'INSERT' or old.booking_status <> 'Pending') then
    new.expires_at := now() + interval '72 hours';
  end if;

  if new.course_session_id is null or not public.holds_seat(new) then
    return new;
  end if;
  if v_same_class
     and (old.booking_status in ('Confirmed', 'Completed') or (old.booking_status = 'Pending' and old.expires_at is null)) then
    return new;
  end if;

  select status, max_students into v_status, v_capacity
  from public.course_sessions
  where id = new.course_session_id
  for update;
  if not found then
    return new;
  end if;

  -- now() is this transaction's start, so holds_seat(old) can still be true after a reservation took the lapsed seat.
  if v_same_class and old.booking_status = 'Pending' and old.expires_at > clock_timestamp() then
    return new;
  end if;

  if v_status <> 'scheduled' then
    raise exception 'Class % is cancelled', new.course_session_id using errcode = 'check_violation';
  end if;

  select count(*) into v_taken
  from public.bookings b
  where b.course_session_id = new.course_session_id
    and public.holds_seat(b)
    and b.id <> new.id;

  if v_taken >= v_capacity then
    raise exception 'Class % is full', new.course_session_id using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function public.check_course_session_update()
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
    v_taken := public.seats_taken(new);

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

create or replace function public.cancel_class(p_course_session_id uuid, p_reason text)
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
    select b.id, b.booking_status
    from public.bookings b
    where b.course_session_id = p_course_session_id and public.holds_seat(b)
    for update
  ) seats;

  update public.bookings b
  set booking_status = 'Class Cancelled'
  where b.course_session_id = p_course_session_id and public.holds_seat(b);
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

drop function public.booking_holds_seat(text);

create function public.guard_booking_hold()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') and new.expires_at is distinct from old.expires_at then
    raise exception 'A seat hold expires 72 hours after booking' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger guard_booking_hold
  before update of expires_at on public.bookings
  for each row execute function public.guard_booking_hold();

create function public.reserve_seat(p_course_session_id uuid, p_material_type_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student uuid := auth.uid();
  v_class public.course_sessions;
  v_booking public.bookings;
begin
  if not exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = v_student and u.active and r.name = 'student'
  ) then
    raise exception 'Only active students can book classes' using errcode = 'insufficient_privilege';
  end if;

  select * into v_class from public.course_sessions where id = p_course_session_id for update;
  if not found then
    raise exception 'Class % does not exist', p_course_session_id using errcode = 'PT404';
  end if;

  select * into v_booking
  from public.bookings b
  where b.user_id = v_student and b.course_session_id = p_course_session_id and public.holds_seat(b);
  if found then
    return v_booking;
  end if;

  if v_class.status <> 'scheduled' then
    raise exception 'Class % is cancelled', p_course_session_id using errcode = 'check_violation';
  end if;
  if v_class.start_date < current_date then
    raise exception 'Class % has already started', p_course_session_id using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.courses where id = v_class.course_id and active) then
    raise exception 'Course % is not open for booking', v_class.course_id using errcode = 'check_violation';
  end if;

  update public.bookings
  set booking_status = 'Expired'
  where user_id = v_student and course_session_id = p_course_session_id
    and booking_status = 'Pending' and expires_at <= now();

  insert into public.bookings (user_id, course_session_id, material_type_id, booking_status)
  values (v_student, p_course_session_id, p_material_type_id, 'Pending')
  returning * into v_booking;

  return v_booking;
end;
$$;

create function public.expire_seat_holds()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_expired integer;
begin
  update public.bookings
  set booking_status = 'Expired'
  where booking_status = 'Pending' and expires_at <= now();
  get diagnostics v_expired = row_count;
  return v_expired;
end;
$$;

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule('expire-seat-holds', '*/5 * * * *', 'select public.expire_seat_holds()');

revoke execute on function public.holds_seat(public.bookings) from public, anon;
revoke execute on function public.seats_taken(public.course_sessions) from public, anon;
revoke execute on function public.guard_booking_hold() from public, anon, authenticated;
revoke execute on function public.reserve_seat(uuid, uuid) from public, anon;
revoke execute on function public.expire_seat_holds() from public, anon, authenticated;
grant execute on function public.holds_seat(public.bookings) to authenticated;
grant execute on function public.seats_taken(public.course_sessions) to authenticated;
grant execute on function public.reserve_seat(uuid, uuid) to authenticated;
