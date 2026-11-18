begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(3);

select is(
  (select count(*)::int from public.bookings where booking_status = 'Pending' and expires_at is not null),
  0, 'pending bookings made before seat holds get no expiry');
select is(
  (select count(*)::int from public.bookings b where booking_status = 'Pending' and not public.holds_seat(b)),
  0, 'pending bookings made before seat holds keep their seats');
select is(public.expire_seat_holds(), 0, 'the hold cleanup leaves bookings made before seat holds alone');

select * from finish();
rollback;
