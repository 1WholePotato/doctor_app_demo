create function public.forbid_append_only_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% rows are append-only', tg_table_name using errcode = 'insufficient_privilege';
end;
$$;

revoke execute on function public.forbid_append_only_change() from public, anon, authenticated;

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.users (id),
  action text not null check (action in ('record_refund', 'resolve_review_flag')),
  booking_id uuid references public.bookings (id),
  details jsonb not null,
  recorded_at timestamptz not null default clock_timestamp()
);

comment on table public.admin_audit_log is
  'Append-only record of admin actions taken through record_refund and resolve_review_flag.';

create index admin_audit_log_booking_id_idx on public.admin_audit_log (booking_id);

alter table public.admin_audit_log enable row level security;
revoke all on table public.admin_audit_log from public, anon, authenticated, service_role;
grant select on table public.admin_audit_log to authenticated, service_role;

create policy admin_audit_log_select_admin on public.admin_audit_log
  for select to authenticated
  using ((select public.is_admin()));

create trigger forbid_admin_audit_log_change
  before update or delete on public.admin_audit_log
  for each row execute function public.forbid_append_only_change();

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id),
  payment_id uuid not null references public.payments (id),
  refund_payment_id uuid not null unique references public.payments (id),
  amount numeric(10,2) not null check (amount > 0),
  reason text not null check (btrim(reason) <> ''),
  external_reference text not null check (btrim(external_reference) <> ''),
  keeps_document_access boolean not null,
  recorded_by uuid not null references public.users (id),
  recorded_at timestamptz not null default clock_timestamp()
);

comment on table public.refunds is
  'Refunds an admin made outside the app, one row each. payment_id is the original Paid payment; refund_payment_id is the Refunded payments row this refund added next to it. Neither payment is ever changed.';
comment on column public.refunds.external_reference is
  'The bank or Ozow reference of the refund, unique ignoring case. Recording the same refund twice with this reference returns the first record.';
comment on column public.refunds.keeps_document_access is
  'Whether the student keeps access to course documents after this refund. The latest refund on a booking decides; see documents_withdrawn(bookings).';

create unique index refunds_external_reference_key on public.refunds (upper(external_reference));
create index refunds_booking_id_idx on public.refunds (booking_id);
create index refunds_payment_id_idx on public.refunds (payment_id);

alter table public.refunds enable row level security;
revoke all on table public.refunds from public, anon, authenticated, service_role;
grant select on table public.refunds to authenticated, service_role;

create policy refunds_select_own on public.refunds
  for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id and b.user_id = (select auth.uid())));

create policy refunds_select_admin on public.refunds
  for select to authenticated
  using ((select public.is_admin()));

create trigger forbid_refund_change
  before update or delete on public.refunds
  for each row execute function public.forbid_append_only_change();

create function public.documents_withdrawn(b public.bookings)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((
    select not r.keeps_document_access
    from public.refunds r
    where r.booking_id = b.id
    order by r.recorded_at desc, r.id desc
    limit 1), false);
$$;

comment on function public.documents_withdrawn(public.bookings) is
  'True when the latest refund on the booking withdrew the student''s access to course documents.';

revoke execute on function public.documents_withdrawn(public.bookings) from public, anon;
grant execute on function public.documents_withdrawn(public.bookings) to authenticated, service_role;

alter table public.booking_review_flags
  add column resolved_by uuid references public.users (id) on delete set null,
  add column resolution_note text,
  add constraint booking_review_flags_resolution_note check (resolution_note is null or resolved_at is not null);

comment on column public.booking_review_flags.resolution_note is
  'Why an admin resolved the flag, set by resolve_review_flag. A resolved flag with no note was resolved automatically: settle_payment_attempt closes payment_investigation once Ozow decides.';

create function public.reopen_resolved_review_flag()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.booking_review_flags
  set resolved_at = null, resolved_by = null, resolution_note = null, details = new.details, flagged_at = new.flagged_at
  where booking_id = new.booking_id and reason = new.reason and resolved_at is not null;
  if found then
    return null;
  end if;
  return new;
end;
$$;

comment on function public.reopen_resolved_review_flag() is
  'A flag is unique per booking and reason, so raising it again after an admin resolved it reopens that row with the new details. The earlier resolution stays in admin_audit_log.';

revoke execute on function public.reopen_resolved_review_flag() from public, anon, authenticated;

create trigger reopen_resolved_review_flag
  before insert on public.booking_review_flags
  for each row execute function public.reopen_resolved_review_flag();

create function public.review_flags()
returns setof public.booking_review_flags
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin('read the review queue');
  return query
    select * from public.booking_review_flags
    order by resolved_at desc nulls first, flagged_at desc;
end;
$$;

create function public.resolve_review_flag(p_flag_id uuid, p_note text)
returns public.booking_review_flags
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text := nullif(btrim(p_note), '');
  v_flag public.booking_review_flags;
begin
  perform public.require_admin('resolve review flags');
  if v_note is null then
    raise exception 'Write a note saying how this was resolved' using errcode = 'invalid_parameter_value';
  end if;

  select * into v_flag from public.booking_review_flags where id = p_flag_id for update;
  if not found then
    raise exception 'Review flag % does not exist', p_flag_id using errcode = 'no_data_found';
  end if;
  if v_flag.resolved_at is not null then
    return v_flag;
  end if;
  if v_flag.reason = 'payment_investigation' and exists (
    select 1 from public.payment_attempts where booking_id = v_flag.booking_id and status = 'investigating'
  ) then
    raise exception 'Ozow is still checking this payment with the bank. The flag resolves itself when Ozow decides'
      using errcode = 'check_violation';
  end if;

  update public.booking_review_flags
  set resolved_at = now(), resolved_by = auth.uid(), resolution_note = v_note
  where id = p_flag_id
  returning * into v_flag;

  insert into public.admin_audit_log (actor_id, action, booking_id, details)
  values (auth.uid(), 'resolve_review_flag', v_flag.booking_id, jsonb_build_object(
    'flag_id', v_flag.id, 'reason', v_flag.reason, 'flag_details', v_flag.details, 'note', v_note));

  return v_flag;
end;
$$;

create function public.record_refund(
  p_payment_id uuid,
  p_amount numeric,
  p_reason text,
  p_reference text,
  p_keeps_document_access boolean)
returns public.refunds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(regexp_replace(p_reason, '^\s+|\s+$', '', 'g'), '');
  v_reference text := nullif(regexp_replace(p_reference, '^\s+|\s+$', '', 'g'), '');
  v_payment public.payments;
  v_booking public.bookings;
  v_refund public.refunds;
  v_status_before text;
  v_left_on_payment numeric;
  v_paid numeric;
  v_refunded numeric;
  v_ledger_id uuid;
begin
  perform public.require_admin('record refunds');

  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
    raise exception 'Refund amount must be a positive amount in rand and cents' using errcode = 'invalid_parameter_value';
  end if;
  if v_reason is null then
    raise exception 'Give the reason for this refund' using errcode = 'invalid_parameter_value';
  end if;
  if v_reference is null then
    raise exception 'Give the bank or Ozow reference of this refund' using errcode = 'invalid_parameter_value';
  end if;
  if p_keeps_document_access is null then
    raise exception 'Decide whether the student keeps access to course documents' using errcode = 'invalid_parameter_value';
  end if;

  select * into v_payment from public.payments where id = p_payment_id;
  if not found then
    raise exception 'Payment % does not exist', p_payment_id using errcode = 'no_data_found';
  end if;

  select * into v_booking from public.bookings where id = v_payment.booking_id for update;
  v_status_before := v_booking.booking_status;

  select * into v_refund from public.refunds where upper(external_reference) = upper(v_reference);
  if found then
    if v_refund.payment_id = p_payment_id
       and v_refund.amount = p_amount
       and v_refund.reason = v_reason
       and v_refund.keeps_document_access = p_keeps_document_access then
      return v_refund;
    end if;
    raise exception 'Refund reference % is already recorded for a different refund', v_reference using errcode = 'unique_violation';
  end if;

  if exists (select 1 from public.payment_attempts where booking_id = v_booking.id and status = 'investigating') then
    raise exception 'A payment on this booking is under investigation with the bank. Record the refund after Ozow decides'
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.payment_statuses ps where ps.id = v_payment.payment_status_id and ps.name = 'Paid'
  ) then
    raise exception 'Payment % was not received, so it cannot be refunded', p_payment_id using errcode = 'check_violation';
  end if;

  select v_payment.amount - coalesce(sum(r.amount), 0) into v_left_on_payment
  from public.refunds r where r.payment_id = p_payment_id;

  select coalesce(sum(p.amount) filter (where ps.name = 'Paid'), 0),
         coalesce(sum(p.amount) filter (where ps.name = 'Refunded'), 0)
  into v_paid, v_refunded
  from public.payments p
  join public.payment_statuses ps on ps.id = p.payment_status_id
  where p.booking_id = v_booking.id;

  if p_amount > least(v_left_on_payment, v_paid - v_refunded) then
    raise exception 'A refund of R % is more than the R % still refundable on this payment',
      p_amount, greatest(least(v_left_on_payment, v_paid - v_refunded), 0) using errcode = 'check_violation';
  end if;

  insert into public.payments (booking_id, amount, payment_date, payment_status_id)
  select v_booking.id, p_amount, now(), ps.id from public.payment_statuses ps where ps.name = 'Refunded'
  returning id into v_ledger_id;

  insert into public.refunds (
    booking_id, payment_id, refund_payment_id, amount, reason, external_reference, keeps_document_access, recorded_by)
  values (v_booking.id, p_payment_id, v_ledger_id, p_amount, v_reason, v_reference, p_keeps_document_access, auth.uid())
  returning * into v_refund;

  if v_booking.booking_status in ('Pending', 'Confirmed') and v_refunded + p_amount >= v_paid then
    update public.bookings set booking_status = 'Cancelled' where id = v_booking.id returning * into v_booking;
  end if;

  insert into public.admin_audit_log (actor_id, action, booking_id, details)
  values (auth.uid(), 'record_refund', v_booking.id, jsonb_build_object(
    'refund_id', v_refund.id, 'payment_id', p_payment_id, 'refund_payment_id', v_ledger_id,
    'amount', p_amount, 'reason', v_reason, 'external_reference', v_reference,
    'keeps_document_access', p_keeps_document_access,
    'booking_status_before', v_status_before, 'booking_status_after', v_booking.booking_status));

  return v_refund;
end;
$$;

comment on function public.record_refund(uuid, numeric, text, text, boolean) is
  'Records a refund an admin already made outside the app against one Paid payment. Adds a Refunded payments row and a refunds row; the original payment is untouched. A refund that brings a Pending or Confirmed booking to fully refunded cancels it and frees the seat. Partial refunds are allowed up to what is still refundable. Refused while a payment on the booking is under investigation, since Ozow may still settle it.';

revoke execute on function public.review_flags() from public, anon;
revoke execute on function public.resolve_review_flag(uuid, text) from public, anon;
revoke execute on function public.record_refund(uuid, numeric, text, text, boolean) from public, anon;
grant execute on function public.review_flags() to authenticated;
grant execute on function public.resolve_review_flag(uuid, text) to authenticated;
grant execute on function public.record_refund(uuid, numeric, text, text, boolean) to authenticated;

create view public.admin_booking_overview
with (security_invoker = true)
as
select
  b.id,
  b.created_at,
  b.booking_status,
  public.holds_seat(b) as holds_seat,
  b.expires_at,
  b.user_id,
  btrim(u.first_name || ' ' || u.last_name) as student_name,
  u.email as student_email,
  lower(u.first_name || ' ' || u.last_name || ' ' || u.email) as student_search,
  b.course_session_id,
  cs.start_date as class_start_date,
  cs.start_time as class_start_time,
  cs.status as class_status,
  c.id as course_id,
  c.course_title,
  mt.name as material_name,
  mt.kind as material_kind,
  b.course_price,
  b.material_fee,
  b.total_amount,
  money.paid_amount,
  money.refunded_amount,
  case
    when money.refunded_amount > 0 and money.refunded_amount >= money.paid_amount then 'refunded'
    when money.refunded_amount > 0 then 'partly_refunded'
    when money.paid_amount > 0 then 'paid'
    when exists (select 1 from public.payment_attempts pa where pa.booking_id = b.id and pa.status = 'investigating') then 'investigating'
    when exists (select 1 from public.payment_attempts pa where pa.booking_id = b.id and pa.status = 'open') then 'awaiting'
    else 'unpaid'
  end as payment_state,
  public.documents_withdrawn(b) as documents_withdrawn
from public.bookings b
join public.users u on u.id = b.user_id
left join public.course_sessions cs on cs.id = b.course_session_id
left join public.courses c on c.id = cs.course_id
left join public.material_types mt on mt.id = b.material_type_id
cross join lateral (
  select coalesce(sum(p.amount) filter (where ps.name = 'Paid'), 0) as paid_amount,
         coalesce(sum(p.amount) filter (where ps.name = 'Refunded'), 0) as refunded_amount
  from public.payments p
  join public.payment_statuses ps on ps.id = p.payment_status_id
  where p.booking_id = b.id
) money
where (select public.is_admin());

comment on view public.admin_booking_overview is
  'One row per booking for the admin bookings page: student, class, material, money received and refunded, and payment_state (refunded, partly_refunded, paid, investigating, awaiting, unpaid). Empty for anyone but an admin.';

create view public.printed_material_demand
with (security_invoker = true)
as
select
  cs.id as course_session_id,
  c.id as course_id,
  c.course_title,
  cs.start_date,
  cs.start_time,
  cs.end_date,
  l.name as location_name,
  count(b.id) filter (where b.booking_status = 'Confirmed')::integer as confirmed,
  count(b.id) filter (where b.booking_status = 'Pending')::integer as held,
  count(b.id)::integer as books_needed
from public.course_sessions cs
join public.courses c on c.id = cs.course_id
join public.locations l on l.id = cs.location_id
left join (public.bookings b join public.material_types mt on mt.id = b.material_type_id and mt.kind = 'printed')
  on b.course_session_id = cs.id
 and b.booking_status in ('Pending', 'Confirmed')
 and public.holds_seat(b)
where cs.status = 'scheduled'
  and cs.start_date >= current_date
  and (select public.is_admin())
group by cs.id, c.id, c.course_title, l.name;

comment on view public.printed_material_demand is
  'Printed books to order for each upcoming scheduled class: confirmed bookings plus seats still held. Empty for anyone but an admin.';

revoke all on table public.admin_booking_overview, public.printed_material_demand from public, anon, authenticated;
grant select on table public.admin_booking_overview, public.printed_material_demand to authenticated;
