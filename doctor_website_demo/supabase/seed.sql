-- Local synthetic fixtures. Role IDs for admin and student match the existing app constants.
begin;

insert into public.roles (id, name)
values ('ef387d99-bdbd-4304-b6ab-946b58475aa1', 'admin'),
       ('4fd9e72e-f94b-4222-b5c1-95b447088d4d', 'student'),
       ('b0100000-0000-4000-8000-000000000003', 'instructor');

-- Use the same synthetic accounts across resets so demo scenarios are reproducible.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select '00000000-0000-0000-0000-000000000000', fixture.id, 'authenticated',
       'authenticated', fixture.email,
       extensions.crypt('LocalDemo-B01!', extensions.gen_salt('bf')),
       now(), '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('first_name', 'Fixture', 'last_name', fixture.persona),
       now(), now(), '', '', '', ''
from (values
  ('b0100000-0000-4000-8000-000000000011'::uuid, 'admin@example.test', 'Admin'),
  ('b0100000-0000-4000-8000-000000000012'::uuid, 'student@example.test', 'Student'),
  ('b0100000-0000-4000-8000-000000000013'::uuid, 'instructor@example.test', 'Instructor')
) as fixture(id, email, persona);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change, email_change_sent_at
)
-- The registrant has requested an email change that is still waiting for confirmation.
values ('00000000-0000-0000-0000-000000000000', 'b0100000-0000-4000-8000-000000000014', 'authenticated',
        'authenticated', 'registrant@example.test',
        extensions.crypt('LocalDemo-B01!', extensions.gen_salt('bf')),
        now(), '{"provider":"email","providers":["email"]}'::jsonb,
        '{"first_name":"Fixture","last_name":"Registrant","birth_date":"1995-05-05","passport_num":"TEST-B01-REGISTRANT","cell_num":"0000000014"}'::jsonb,
        now(), now(), '', '', '', 'registrant.next@example.test', now());

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select gen_random_uuid(), id, id::text,
       jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users
where id in ('b0100000-0000-4000-8000-000000000011', 'b0100000-0000-4000-8000-000000000012', 'b0100000-0000-4000-8000-000000000013',
             'b0100000-0000-4000-8000-000000000014');

insert into public.users (
  id, role_id, first_name, last_name, birth_date, passport_num, cell_num, email, sanc_num
)
values
  ('b0100000-0000-4000-8000-000000000011', 'ef387d99-bdbd-4304-b6ab-946b58475aa1', 'Fixture', 'Admin', '1990-01-01', 'TEST-B01-ADMIN', '0000000011', 'admin@example.test', 'TEST-ADMIN'),
  ('b0100000-0000-4000-8000-000000000012', '4fd9e72e-f94b-4222-b5c1-95b447088d4d', 'Fixture', 'Student', '1990-01-01', 'TEST-B01-STUDENT', '0000000012', 'student@example.test', 'TEST-STUDENT'),
  ('b0100000-0000-4000-8000-000000000013', 'b0100000-0000-4000-8000-000000000003', 'Fixture', 'Instructor', '1990-01-01', 'TEST-B01-INSTRUCTOR', '0000000013', 'instructor@example.test', 'TEST-INSTRUCTOR');

insert into public.instructors (id, first_name, last_name, email, cell_num)
values ('b0100000-0000-4000-8000-000000000021', 'Fixture', 'Instructor', 'instructor@example.test', '0000000013');

insert into public.locations (id, name, address)
values ('b0100000-0000-4000-8000-000000000022', 'Fixture Training Room', '1 Example Way');

insert into public.courses (id, course_title, course_description, course_price)
values ('b0100000-0000-4000-8000-000000000023', 'Fixture Clinical Skills', 'Synthetic course for local development.', 100.00);

insert into public.instructor_courses (id, instructor_id, course_id)
values ('b0100000-0000-4000-8000-000000000024', 'b0100000-0000-4000-8000-000000000021', 'b0100000-0000-4000-8000-000000000023');

insert into public.course_sessions (
  id, course_id, instructor_id, location_id, start_date, end_date, start_time, end_time
)
values ('b0100000-0000-4000-8000-000000000025', 'b0100000-0000-4000-8000-000000000023', 'b0100000-0000-4000-8000-000000000021', 'b0100000-0000-4000-8000-000000000022',
        current_date + 30, current_date + 30, '09:00', '12:00');

insert into public.booking_statuses (id, name) values ('b0100000-0000-4000-8000-000000000031', 'confirmed');
insert into public.payment_statuses (id, name) values ('b0100000-0000-4000-8000-000000000032', 'paid');
insert into public.material_types (id, name, fee) values ('b0100000-0000-4000-8000-000000000033', 'digital', 0);

-- The hosted FK points to courses.id despite the booking column name.
insert into public.bookings (
  id, user_id, course_session_id, total_amount, payment_status, material_type_id, booking_status_id
)
values ('b0100000-0000-4000-8000-000000000034', 'b0100000-0000-4000-8000-000000000012', 'b0100000-0000-4000-8000-000000000023', 100.00, 'paid', 'b0100000-0000-4000-8000-000000000033', 'b0100000-0000-4000-8000-000000000031');

insert into public.payments (id, booking_id, amount, payment_date, payment_status_id)
values ('b0100000-0000-4000-8000-000000000035', 'b0100000-0000-4000-8000-000000000034', 100.00, now(), 'b0100000-0000-4000-8000-000000000032');

insert into public.certificates (id, booking_id, certificate_number, issue_date)
values ('b0100000-0000-4000-8000-000000000036', 'b0100000-0000-4000-8000-000000000034', 'FIXTURE-B01-001', current_date);

commit;
