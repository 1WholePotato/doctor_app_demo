alter table public.payment_attempts drop constraint payment_attempts_status_check;
alter table public.payment_attempts
  add constraint payment_attempts_status_check check (status in ('open', 'paid', 'failed'));

comment on column public.payment_attempts.status is
  'open: the student can pay it. paid: Ozow confirmed a matching successful transaction; final. failed: Ozow refused the request, or every transaction on it failed, or it expired unpaid. A failed attempt can still become paid if Ozow later confirms money on it.';

alter table public.booking_review_flags drop constraint booking_review_flags_reason_check;
alter table public.booking_review_flags
  add constraint booking_review_flags_reason_check check (reason in (
    'ambiguous_session', 'duplicate_active_booking', 'unverified_payment_status',
    'late_payment', 'duplicate_payment', 'payment_mismatch'));

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_attempt_id uuid not null references public.payment_attempts (id),
  ozow_transaction_id text not null,
  ozow_status text not null,
  outcome text not null check (outcome in ('paid', 'late_paid', 'review', 'mismatch', 'failed', 'stale', 'noted')),
  transaction jsonb not null,
  recorded_at timestamptz not null default now(),
  unique (ozow_transaction_id, ozow_status)
);

comment on table public.payment_events is
  'Append-only log of Ozow transactions as Ozow''s API reported them, one row per transaction and status, so a repeated notification has no second effect.';
comment on column public.payment_events.outcome is
  'paid: confirmed the held booking. late_paid: the hold had lapsed and a free seat was taken. review: money recorded, booking flagged for an admin. mismatch: reference, amount or currency differ from the attempt. failed: closed the attempt and released the seat. stale: arrived after the attempt was paid. noted: no effect.';

create index payment_events_payment_attempt_id_idx on public.payment_events (payment_attempt_id);

alter table public.payment_events enable row level security;
revoke all on table public.payment_events from public, anon, authenticated, service_role;
grant select on table public.payment_events to service_role;

create function public.forbid_payment_event_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Payment events are append-only' using errcode = 'insufficient_privilege';
end;
$$;

create trigger forbid_payment_event_change
  before update or delete on public.payment_events
  for each row execute function public.forbid_payment_event_change();

create function public.settle_payment_attempt(p_ozow_payment_id text, p_transactions jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.payment_attempts;
  v_booking public.bookings;
  v_tx jsonb;
  v_outcome text;
  v_result text := 'unchanged';
  v_failed boolean := false;
begin
  if jsonb_typeof(p_transactions) is distinct from 'array' then
    raise exception 'Transactions must be a JSON array' using errcode = 'invalid_parameter_value';
  end if;

  select * into v_attempt from public.payment_attempts where ozow_payment_id = p_ozow_payment_id;
  if not found then
    raise exception 'No payment attempt for Ozow payment %', p_ozow_payment_id using errcode = 'no_data_found';
  end if;

  perform 1
  from public.course_sessions cs
  join public.bookings b on b.course_session_id = cs.id
  where b.id = v_attempt.booking_id
  for update of cs;
  select * into v_booking from public.bookings where id = v_attempt.booking_id for update;
  select * into v_attempt from public.payment_attempts where id = v_attempt.id for update;

  for v_tx in
    select t from jsonb_array_elements(p_transactions) t
    where t->>'status' = 'Successful'
    order by t->>'completedDate' nulls last
  loop
    continue when exists (
      select 1 from public.payment_events
      where ozow_transaction_id = v_tx->>'id' and ozow_status = 'Successful');

    if v_tx->>'merchantReference' is distinct from v_attempt.reference
       or v_tx->'amount'->>'currency' is distinct from 'ZAR'
       or (case when jsonb_typeof(v_tx->'amount'->'value') = 'number' then (v_tx->'amount'->>'value')::numeric end)
          is distinct from v_attempt.amount
       or v_attempt.amount <> v_booking.total_amount then
      v_outcome := 'mismatch';
      insert into public.booking_review_flags (booking_id, reason, details)
      values (v_booking.id, 'payment_mismatch', jsonb_build_object(
        'payment_attempt_id', v_attempt.id, 'reference', v_attempt.reference, 'amount', v_attempt.amount,
        'booking_total', v_booking.total_amount, 'transaction', v_tx))
      on conflict (booking_id, reason) do nothing;
    else
      insert into public.payments (booking_id, ozow_transaction_id, amount, payment_date, payment_status_id)
      select v_booking.id, v_tx->>'id', v_attempt.amount, now(), ps.id
      from public.payment_statuses ps where ps.name = 'Paid';

      update public.payment_attempts set status = 'paid' where id = v_attempt.id returning * into v_attempt;

      if v_booking.booking_status in ('Confirmed', 'Completed') then
        v_outcome := 'review';
        insert into public.booking_review_flags (booking_id, reason, details)
        values (v_booking.id, 'duplicate_payment', jsonb_build_object(
          'payment_attempt_id', v_attempt.id, 'ozow_transaction_id', v_tx->>'id', 'amount', v_attempt.amount))
        on conflict (booking_id, reason) do nothing;
      elsif v_booking.booking_status in ('Pending', 'Expired') then
        v_outcome := case when public.holds_seat(v_booking) then 'paid' else 'late_paid' end;
        begin
          update public.bookings set booking_status = 'Confirmed' where id = v_booking.id returning * into v_booking;
        exception when check_violation or unique_violation then
          v_outcome := 'review';
          insert into public.booking_review_flags (booking_id, reason, details)
          values (v_booking.id, 'late_payment', jsonb_build_object(
            'payment_attempt_id', v_attempt.id, 'ozow_transaction_id', v_tx->>'id', 'amount', v_attempt.amount,
            'booking_status', v_booking.booking_status, 'refused', sqlerrm))
          on conflict (booking_id, reason) do nothing;
        end;
      else
        v_outcome := 'review';
        insert into public.booking_review_flags (booking_id, reason, details)
        values (v_booking.id, 'late_payment', jsonb_build_object(
          'payment_attempt_id', v_attempt.id, 'ozow_transaction_id', v_tx->>'id', 'amount', v_attempt.amount,
          'booking_status', v_booking.booking_status))
        on conflict (booking_id, reason) do nothing;
      end if;
    end if;

    insert into public.payment_events (payment_attempt_id, ozow_transaction_id, ozow_status, outcome, transaction)
    values (v_attempt.id, v_tx->>'id', 'Successful', v_outcome, v_tx);
    v_result := v_outcome;
  end loop;

  if v_attempt.status = 'open'
     and not exists (
       select 1 from jsonb_array_elements(p_transactions) t
       where t->>'status' in ('Incomplete', 'Pending'))
     and (v_attempt.expires_at <= now()
          or exists (select 1 from jsonb_array_elements(p_transactions) t where t->>'status' = 'Error')) then
    v_failed := true;
    update public.payment_attempts set status = 'failed' where id = v_attempt.id returning * into v_attempt;
    if v_booking.booking_status = 'Pending' then
      update public.bookings set booking_status = 'Expired' where id = v_booking.id;
    end if;
    v_result := 'failed';
  end if;

  insert into public.payment_events (payment_attempt_id, ozow_transaction_id, ozow_status, outcome, transaction)
  select v_attempt.id, t->>'id', t->>'status',
         case
           when v_attempt.status = 'paid' then 'stale'
           when v_failed and t->>'status' = 'Error' then 'failed'
           else 'noted'
         end,
         t
  from jsonb_array_elements(p_transactions) t
  where t->>'status' is distinct from 'Successful' and t->>'id' is not null and t->>'status' is not null
  on conflict (ozow_transaction_id, ozow_status) do nothing;

  return v_result;
end;
$$;

comment on function public.settle_payment_attempt(text, jsonb) is
  'Applies the transactions Ozow''s API lists for one payment to its attempt and booking. Pass only what Ozow returned for GET /payments/{id}/transactions, never a notification body.';

revoke execute on function public.forbid_payment_event_change() from public, anon, authenticated;
revoke execute on function public.settle_payment_attempt(text, jsonb) from public, anon, authenticated;
grant execute on function public.settle_payment_attempt(text, jsonb) to service_role;

create or replace function public.begin_payment_attempt(p_booking_id uuid, p_student_id uuid)
returns public.payment_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_attempt public.payment_attempts;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking % does not exist', p_booking_id using errcode = 'no_data_found';
  end if;
  if v_booking.user_id <> p_student_id then
    raise exception 'Booking % belongs to another student', p_booking_id using errcode = 'insufficient_privilege';
  end if;
  if v_booking.booking_status <> 'Pending' then
    raise exception 'Booking % is not awaiting payment', p_booking_id using errcode = 'check_violation';
  end if;
  if v_booking.expires_at is null or v_booking.expires_at <= now() then
    raise exception 'The seat hold on booking % has expired', p_booking_id using errcode = 'check_violation';
  end if;
  if v_booking.total_amount <= 0 then
    raise exception 'Booking % has nothing to pay', p_booking_id using errcode = 'check_violation';
  end if;

  select * into v_attempt from public.payment_attempts where booking_id = p_booking_id and status = 'open';
  if found then
    if v_attempt.expires_at = v_booking.expires_at
       and v_attempt.expires_at > clock_timestamp()
       and v_attempt.amount = v_booking.total_amount then
      return v_attempt;
    end if;
    update public.payment_attempts set status = 'failed' where id = v_attempt.id;
  end if;

  insert into public.payment_attempts (booking_id, amount, expires_at)
  values (p_booking_id, v_booking.total_amount, v_booking.expires_at)
  returning * into v_attempt;
  return v_attempt;
end;
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid() and u.active and r.name = 'admin');
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create policy payment_attempts_select_admin on public.payment_attempts
  for select to authenticated
  using ((select public.is_admin()));

grant select on table public.payment_events to authenticated;
create policy payment_events_select_admin on public.payment_events
  for select to authenticated
  using ((select public.is_admin()));

create extension if not exists pg_net with schema extensions;

create function public.request_payment_reconciliation()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_key text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_url is null or v_key is null then
    return null;
  end if;
  return net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/ozow-reconcile',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
    body := '{}'::jsonb);
end;
$$;

comment on function public.request_payment_reconciliation() is
  'Asks the ozow-reconcile Edge Function to re-check open payment attempts with Ozow. Does nothing until the project_url and service_role_key Vault secrets exist.';

revoke execute on function public.request_payment_reconciliation() from public, anon, authenticated;

select cron.schedule('reconcile-ozow-payments', '*/10 * * * *', 'select public.request_payment_reconciliation()');
