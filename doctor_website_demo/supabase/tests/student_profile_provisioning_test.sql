begin;
select plan(13);

create function pg_temp.sign_up(address text, metadata jsonb) returns uuid
language sql as $$
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', address, metadata)
  returning id;
$$;

select results_eq(
  $$select r.name, u.passport_num, u.sanc_num, u.active
    from public.users u join public.roles r on r.id = u.role_id
    where u.email = 'registrant@example.test'$$,
  $$values ('student'::text, 'TEST-B01-REGISTRANT'::text, null::text, true)$$,
  'the seeded registrant was provisioned as a student by the trigger'
);

select pg_temp.sign_up('new.student@example.test', '{
  "first_name": " Tia ", "last_name": "Ndlovu", "birth_date": "1999-09-09", "id_num": "9909090000000",
  "passport_num": null, "cell_num": "0821234567", "sanc_num": " SANC-1 "
}');

select results_eq(
  $$select r.name, u.first_name, u.birth_date, u.id_num, u.passport_num, u.cell_num, u.sanc_num
    from public.users u join public.roles r on r.id = u.role_id
    where u.email = 'new.student@example.test'$$,
  $$values ('student'::text, 'Tia'::text, '1999-09-09'::date, '9909090000000'::text, null::text, '0821234567'::text, 'SANC-1'::text)$$,
  'a sign-up with registration details gets one student profile'
);

select is(
  (select count(*) from public.users u join auth.users a on a.id = u.id where a.email = 'new.student@example.test'),
  1::bigint,
  'the new account has exactly one profile'
);

select throws_ok(
  $$select pg_temp.sign_up('wants.admin@example.test', '{
    "first_name": "Eve", "last_name": "Admin", "birth_date": "1990-01-01", "passport_num": "P1",
    "cell_num": "0820000000", "role": "admin"
  }')$$,
  '42501', 'Accounts cannot choose their own role',
  'a sign-up asking for a role is rejected'
);

select throws_ok(
  $$select pg_temp.sign_up('wants.admin.id@example.test', '{
    "first_name": "Eve", "last_name": "Admin", "birth_date": "1990-01-01", "passport_num": "P1",
    "cell_num": "0820000000", "role_id": "ef387d99-bdbd-4304-b6ab-946b58475aa1"
  }')$$,
  '42501', 'Accounts cannot choose their own role',
  'a sign-up asking for a role id is rejected'
);

select throws_ok(
  $$select pg_temp.sign_up('two.documents@example.test', '{
    "first_name": "Bo", "last_name": "Both", "birth_date": "1990-01-01", "id_num": "9001010000000",
    "passport_num": "P1", "cell_num": "0820000000"
  }')$$,
  '23514', null,
  'a sign-up with both an ID and a passport number is rejected'
);

select throws_ok(
  $$select pg_temp.sign_up('no.cell@example.test', '{
    "first_name": "No", "last_name": "Cell", "birth_date": "1990-01-01", "passport_num": "P1", "cell_num": "  "
  }')$$,
  '23502', null,
  'a sign-up with a blank required field is rejected'
);

select is(
  (select count(*) from auth.users where email in ('wants.admin@example.test', 'two.documents@example.test', 'no.cell@example.test')),
  0::bigint,
  'a rejected sign-up leaves no account behind'
);

select pg_temp.sign_up('staff@example.test', '{"first_name": "Staff", "last_name": "Member"}');

select is(
  (select count(*) from public.users where email = 'staff@example.test'),
  0::bigint,
  'accounts created without registration details get no automatic profile'
);

select set_config('test.staff_id', id::text, true) from auth.users where email = 'staff@example.test';
set local role anon;
select throws_ok(
  $$insert into public.users (id, role_id, first_name, last_name, birth_date, passport_num, cell_num, email)
    values (current_setting('test.staff_id')::uuid, 'ef387d99-bdbd-4304-b6ab-946b58475aa1', 'Eve', 'Admin', '1990-01-01', 'P1', '0820000000', 'eve@example.test')$$,
  '42501', null,
  'anon cannot insert a profile directly'
);
reset role;

select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.staff_id'), 'role', 'authenticated')::text, true);
set local role authenticated;
select throws_ok(
  $$insert into public.users (id, role_id, first_name, last_name, birth_date, passport_num, cell_num, email)
    values (auth.uid(), 'ef387d99-bdbd-4304-b6ab-946b58475aa1', 'Staff', 'Member', '1990-01-01', 'P1', '0820000000', 'staff@example.test')$$,
  '42501', null,
  'a signed-in account cannot insert its own profile with a chosen role'
);
reset role;

select ok(
  not exists (
    select 1
    from unnest(array['anon', 'authenticated']) as grantee,
         unnest(array[
           'public.insert_student_profile(auth.users)',
           'public.is_student_registration(jsonb)',
           'public.provision_student_profile()'
         ]) as fn
    where has_function_privilege(grantee, fn, 'execute')
  ),
  'API roles cannot call the provisioning functions'
);

select ok(
  has_table_privilege('service_role', 'public.users', 'insert'),
  'service_role keeps direct profile writes for operator scripts'
);

select * from finish();
rollback;
