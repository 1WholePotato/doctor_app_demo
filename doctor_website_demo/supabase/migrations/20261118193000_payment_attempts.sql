create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id),
  reference text not null unique
    default 'DA' || upper(left(replace(gen_random_uuid()::text, '-', ''), 10))
    check (reference ~ '^[A-Z0-9]{1,20}$'),
  amount numeric(10,2) not null check (amount > 0),
  expires_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'failed')),
  ozow_payment_id text unique,
  redirect_url text,
  created_at timestamptz not null default now(),
  check ((ozow_payment_id is null) = (redirect_url is null))
);

comment on table public.payment_attempts is
  'One Ozow payment request per row. The amount and expiry are copied from the booking when the attempt starts; only the service role writes rows.';
comment on column public.payment_attempts.reference is
  'Sent to Ozow as merchantReference and beneficiaryReference. Letters and digits only, at most 20 characters.';
comment on column public.payment_attempts.status is
  'open: the request is being created or the student can pay it. failed: Ozow refused to create it, so the next attempt starts fresh.';

create unique index payment_attempts_one_open_per_booking
  on public.payment_attempts (booking_id)
  where status = 'open';

alter table public.payment_attempts enable row level security;
revoke all on table public.payment_attempts from public, anon, authenticated;
grant select on table public.payment_attempts to authenticated;
grant all on table public.payment_attempts to service_role;

create policy payment_attempts_select_own on public.payment_attempts
  for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id and b.user_id = (select auth.uid())));

create function public.begin_payment_attempt(p_booking_id uuid, p_student_id uuid)
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
    return v_attempt;
  end if;

  insert into public.payment_attempts (booking_id, amount, expires_at)
  values (p_booking_id, v_booking.total_amount, v_booking.expires_at)
  returning * into v_attempt;
  return v_attempt;
end;
$$;

revoke execute on function public.begin_payment_attempt(uuid, uuid) from public, anon, authenticated;
grant execute on function public.begin_payment_attempt(uuid, uuid) to service_role;
