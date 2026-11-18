insert into public.booking_statuses (name)
values ('Pending'), ('Confirmed'), ('Cancelled'), ('Completed')
on conflict (name) do nothing;

insert into public.payment_statuses (name)
values ('Pending'), ('Paid'), ('Failed'), ('Refunded')
on conflict (name) do nothing;

create table public.booking_review_flags (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  reason text not null check (reason in ('ambiguous_session', 'duplicate_active_booking', 'unverified_payment_status')),
  details jsonb not null,
  flagged_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (booking_id, reason)
);

alter table public.booking_review_flags enable row level security;
revoke all on table public.booking_review_flags from public, anon, authenticated;

alter table public.bookings drop constraint fk_booking_course;
alter table public.bookings alter column course_session_id drop not null;

update public.bookings b
set course_session_id = only_session.id
from (
  select course_id, (array_agg(id))[1] as id
  from public.course_sessions
  group by course_id
  having count(*) = 1
) only_session
where only_session.course_id = b.course_session_id
  and not exists (select 1 from public.course_sessions s where s.id = b.course_session_id);

insert into public.booking_review_flags (booking_id, reason, details)
select b.id, 'ambiguous_session',
       jsonb_build_object(
         'legacy_course_session_id', b.course_session_id,
         'candidate_session_ids', coalesce(
           (select jsonb_agg(s.id order by s.start_date, s.start_time) from public.course_sessions s where s.course_id = b.course_session_id),
           '[]'::jsonb))
from public.bookings b
where not exists (select 1 from public.course_sessions s where s.id = b.course_session_id)
on conflict (booking_id, reason) do nothing;

update public.bookings b
set course_session_id = null
where not exists (select 1 from public.course_sessions s where s.id = b.course_session_id);

alter table public.bookings
  add column booking_status text not null default 'Pending'
  references public.booking_statuses (name) on update cascade;

update public.bookings b
set booking_status = bs.name
from public.booking_statuses bs
where bs.id = b.booking_status_id;

alter table public.bookings drop column booking_status_id;

with ranked as (
  select id, user_id, course_session_id,
         first_value(id) over w as kept_booking_id,
         row_number() over w as position
  from public.bookings
  where course_session_id is not null
    and booking_status in ('Pending', 'Confirmed', 'Completed')
  window w as (partition by user_id, course_session_id order by created_at nulls last, id)
), flagged as (
  insert into public.booking_review_flags (booking_id, reason, details)
  select id, 'duplicate_active_booking',
         jsonb_build_object('legacy_course_session_id', course_session_id, 'kept_booking_id', kept_booking_id)
  from ranked
  where position > 1
  on conflict (booking_id, reason) do nothing
)
update public.bookings b
set course_session_id = null
from ranked
where ranked.id = b.id and ranked.position > 1;

insert into public.booking_review_flags (booking_id, reason, details)
select b.id, 'unverified_payment_status',
       jsonb_build_object(
         'legacy_payment_status', b.payment_status,
         'payment_ids', coalesce((select jsonb_agg(p.id) from public.payments p where p.booking_id = b.id), '[]'::jsonb))
from public.bookings b
where lower(b.payment_status) <> 'pending'
  and not exists (
    select 1
    from public.payments p
    join public.payment_statuses ps on ps.id = p.payment_status_id
    where p.booking_id = b.id and lower(ps.name) = lower(b.payment_status))
on conflict (booking_id, reason) do nothing;

alter table public.bookings drop column payment_status;

alter table public.bookings
  add constraint bookings_course_session_id_fkey
  foreign key (course_session_id) references public.course_sessions (id);

alter table public.bookings
  add constraint bookings_course_session_required
  check (course_session_id is not null) not valid;

create unique index bookings_one_active_per_student_session
  on public.bookings (user_id, course_session_id)
  where booking_status in ('Pending', 'Confirmed', 'Completed');

create index bookings_course_session_id_idx on public.bookings (course_session_id);
