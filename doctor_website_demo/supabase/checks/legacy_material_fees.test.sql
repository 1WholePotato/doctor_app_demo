begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(7);

select results_eq(
  $$select name, kind from public.material_types order by name$$,
  $$values ('Electronic', 'electronic'), ('Hard Copy', 'printed')$$,
  'a free legacy material type becomes electronic and a paid one printed');

select results_eq(
  $$select distinct printed_material_fee from public.courses$$,
  $$values (250.00::numeric)$$,
  'each legacy course starts with the printed fee its material type advertised');

select results_eq(
  $$select id, course_session_id is null, material_type_id, course_price, material_fee, total_amount
    from public.bookings order by id$$,
  $$values ('c0300000-0000-4000-8000-0000000000c1'::uuid, false, 'c0900000-0000-4000-8000-000000000001'::uuid, 100.00::numeric, 0.00::numeric, 100.00::numeric),
           ('c0300000-0000-4000-8000-0000000000c2'::uuid, true, 'c0900000-0000-4000-8000-000000000002'::uuid, 100.00::numeric, 250.00::numeric, 350.00::numeric),
           ('c0300000-0000-4000-8000-0000000000c3'::uuid, true, null::uuid, 100.00::numeric, 0.00::numeric, 100.00::numeric),
           ('c0300000-0000-4000-8000-0000000000c4'::uuid, false, null::uuid, 100.00::numeric, 0.00::numeric, 100.00::numeric),
           ('c0300000-0000-4000-8000-0000000000c5'::uuid, true, null::uuid, 100.00::numeric, 0.00::numeric, 100.00::numeric),
           ('c0300000-0000-4000-8000-0000000000c6'::uuid, true, null::uuid, 100.00::numeric, 0.00::numeric, 100.00::numeric)$$,
  'existing bookings keep their amounts, including ones still waiting for a class');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0300000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select throws_ok(
  $$update public.bookings set course_session_id = 'c0300000-0000-4000-8000-0000000000b2' where id = 'c0300000-0000-4000-8000-0000000000c2'$$,
  '42501', null, 'a student cannot pick a class for a booking still waiting for one');
set local role service_role;
select lives_ok(
  $$update public.bookings set course_session_id = 'c0300000-0000-4000-8000-0000000000b2' where id = 'c0300000-0000-4000-8000-0000000000c2'$$,
  'the service role links a booking still waiting for a class');
reset role;
select results_eq(
  $$select course_session_id, course_price, material_fee, total_amount from public.bookings where id = 'c0300000-0000-4000-8000-0000000000c2'$$,
  $$values ('c0300000-0000-4000-8000-0000000000b2'::uuid, 100.00::numeric, 250.00::numeric, 350.00::numeric)$$,
  'linking a legacy booking to its class keeps its amounts');

update public.courses set course_price = 900, printed_material_fee = 900;
select results_eq(
  $$select sum(total_amount) from public.bookings$$,
  $$values (850.00::numeric)$$,
  'later course price and printed fee edits leave legacy bookings alone');

select * from finish();
rollback;
