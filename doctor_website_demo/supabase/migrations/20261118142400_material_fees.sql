alter table public.material_types add column kind text;

update public.material_types
set kind = case when fee = 0 then 'electronic' else 'printed' end;

alter table public.material_types
  alter column kind set not null,
  add constraint material_types_kind_check check (kind in ('electronic', 'printed')),
  add constraint material_types_electronic_free check (kind <> 'electronic' or fee = 0);

comment on column public.material_types.fee is
  'List fee from before course pricing. Bookings are priced from courses.printed_material_fee, never from this column.';

alter table public.courses
  add column printed_material_fee numeric(10,2) not null default 0,
  add constraint courses_printed_material_fee_check check (printed_material_fee >= 0);

update public.courses
set printed_material_fee = coalesce(
  (select max(fee) from public.material_types where kind = 'printed' and active), 0);

alter table public.bookings add column course_price numeric(10,2);

alter table public.bookings
  alter column course_price type numeric(10,2) using total_amount - material_fee;

alter table public.bookings
  alter column course_price set not null,
  add constraint bookings_course_price_check check (course_price >= 0),
  add constraint bookings_total_amount_matches check (total_amount = course_price + material_fee);

create function public.course_material_prices(p_course_id uuid)
returns table (
  material_type_id uuid,
  name text,
  kind text,
  course_price numeric,
  material_fee numeric,
  total_amount numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select mt.id, mt.name, mt.kind, c.course_price, fee.amount, c.course_price + fee.amount
  from public.courses c
  cross join public.material_types mt
  cross join lateral (
    select case mt.kind when 'printed' then c.printed_material_fee else 0 end as amount
  ) fee
  where c.id = p_course_id and mt.active
  order by mt.kind, mt.name;
$$;

create function public.price_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course_id uuid;
begin
  if new.course_session_id is null then
    raise exception 'A booking must name a class' using errcode = 'check_violation';
  end if;
  if new.material_type_id is null then
    raise exception 'Choose electronic or printed material for this booking' using errcode = 'not_null_violation';
  end if;

  select course_id into v_course_id from public.course_sessions where id = new.course_session_id;
  if not found then
    raise exception 'Class % does not exist', new.course_session_id using errcode = 'foreign_key_violation';
  end if;

  select p.course_price, p.material_fee, p.total_amount
  into new.course_price, new.material_fee, new.total_amount
  from public.course_material_prices(v_course_id) p
  where p.material_type_id = new.material_type_id;
  if not found then
    raise exception 'Material type % is not offered', new.material_type_id using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger price_booking
  before insert on public.bookings
  for each row execute function public.price_booking();

create function public.guard_booking_price()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if (new.material_type_id, new.course_price, new.material_fee, new.total_amount)
       is distinct from (old.material_type_id, old.course_price, old.material_fee, old.total_amount) then
    raise exception 'Booking prices are fixed when the booking is made' using errcode = 'insufficient_privilege';
  end if;
  if new.course_session_id is distinct from old.course_session_id
     and (old.course_session_id is null
          or (select course_id from public.course_sessions where id = new.course_session_id)
             is distinct from (select course_id from public.course_sessions where id = old.course_session_id)) then
    raise exception 'A booking can only move to another class of the course it was priced for'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger guard_booking_price
  before update of course_session_id, material_type_id, course_price, material_fee, total_amount on public.bookings
  for each row execute function public.guard_booking_price();

revoke execute on function public.course_material_prices(uuid) from public, anon;
grant execute on function public.course_material_prices(uuid) to authenticated;
revoke execute on function public.price_booking() from public, anon, authenticated;
revoke execute on function public.guard_booking_price() from public, anon, authenticated;
