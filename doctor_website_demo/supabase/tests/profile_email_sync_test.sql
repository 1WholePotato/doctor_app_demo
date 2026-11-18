begin;
select plan(10);

select results_eq(
  $$select a.email, a.email_change, u.email
    from auth.users a join public.users u on u.id = a.id
    where a.id = 'b0100000-0000-4000-8000-000000000014'$$,
  $$values ('registrant@example.test'::varchar, 'registrant.next@example.test'::varchar, 'registrant@example.test'::text)$$,
  'a pending email change leaves the login and profile email on the confirmed address'
);

update auth.users
set email_change = 'student.pending@example.test', email_change_sent_at = now()
where id = 'b0100000-0000-4000-8000-000000000012';

select is(
  (select email from public.users where id = 'b0100000-0000-4000-8000-000000000012'),
  'student@example.test',
  'requesting an email change does not touch the profile email'
);

update auth.users
set email = 'student.confirmed@example.test', email_change = '', email_change_sent_at = null
where id = 'b0100000-0000-4000-8000-000000000012';

select results_eq(
  $$select a.email::text, u.email
    from auth.users a join public.users u on u.id = a.id
    where a.id = 'b0100000-0000-4000-8000-000000000012'$$,
  $$values ('student.confirmed@example.test'::text, 'student.confirmed@example.test'::text)$$,
  'a confirmed email change updates the profile email in the same transaction'
);

update public.users set email = 'taken@example.test' where id = 'b0100000-0000-4000-8000-000000000013';

select throws_ok(
  $$update auth.users set email = 'taken@example.test' where id = 'b0100000-0000-4000-8000-000000000011'$$,
  '23505', null,
  'an email change the profile cannot take is rejected'
);

select is(
  (select email::text from auth.users where id = 'b0100000-0000-4000-8000-000000000011'),
  'admin@example.test',
  'a rejected email change keeps the authoritative login email'
);

update auth.users set raw_user_meta_data = raw_user_meta_data || '{"note": "unrelated"}'
where id = 'b0100000-0000-4000-8000-000000000013';

select is(
  (select email from public.users where id = 'b0100000-0000-4000-8000-000000000013'),
  'taken@example.test',
  'updates that leave the login email alone do not rewrite the profile'
);

select set_config('request.jwt.claims', json_build_object('sub', 'b0100000-0000-4000-8000-000000000012', 'role', 'authenticated')::text, true);
set local role authenticated;

select throws_ok(
  $$update public.users set email = 'self.service@example.test' where id = auth.uid()$$,
  '42501', null,
  'a signed-in student cannot write the profile email'
);

select lives_ok(
  $$update public.users set cell_num = '0829999999' where id = auth.uid()$$,
  'a signed-in student can still update other profile fields'
);
reset role;

set local role anon;
select throws_ok(
  $$update public.users set email = 'anon@example.test' where id = 'b0100000-0000-4000-8000-000000000012'$$,
  '42501', null,
  'anon cannot write the profile email'
);
reset role;

select ok(
  not has_function_privilege('anon', 'public.sync_profile_email()', 'execute')
    and not has_function_privilege('authenticated', 'public.sync_profile_email()', 'execute'),
  'API roles cannot call the email sync function'
);

select * from finish();
rollback;
