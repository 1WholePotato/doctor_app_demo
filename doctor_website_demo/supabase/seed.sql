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
  ('b0100000-0000-4000-8000-000000000013'::uuid, 'instructor@example.test', 'Instructor'),
  ('b0100000-0000-4000-8000-000000000014'::uuid, 'second-student@example.test', 'Second Student')
) as fixture(id, email, persona);

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select gen_random_uuid(), id, id::text,
       jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users
where id in ('b0100000-0000-4000-8000-000000000011', 'b0100000-0000-4000-8000-000000000012', 'b0100000-0000-4000-8000-000000000013', 'b0100000-0000-4000-8000-000000000014');

insert into public.users (
  id, role_id, first_name, last_name, birth_date, passport_num, cell_num, email, sanc_num
)
values
  ('b0100000-0000-4000-8000-000000000011', 'ef387d99-bdbd-4304-b6ab-946b58475aa1', 'Fixture', 'Admin', '1990-01-01', 'TEST-B01-ADMIN', '0000000011', 'admin@example.test', 'TEST-ADMIN'),
  ('b0100000-0000-4000-8000-000000000012', '4fd9e72e-f94b-4222-b5c1-95b447088d4d', 'Fixture', 'Student', '1990-01-01', 'TEST-B01-STUDENT', '0000000012', 'student@example.test', 'TEST-STUDENT'),
  ('b0100000-0000-4000-8000-000000000013', 'b0100000-0000-4000-8000-000000000003', 'Fixture', 'Instructor', '1990-01-01', 'TEST-B01-INSTRUCTOR', '0000000013', 'instructor@example.test', 'TEST-INSTRUCTOR'),
  ('b0100000-0000-4000-8000-000000000014', '4fd9e72e-f94b-4222-b5c1-95b447088d4d', 'Fixture', 'Second Student', '1990-01-01', 'TEST-B10-STUDENT', '0000000014', 'second-student@example.test', 'TEST-STUDENT-2');

insert into public.instructors (id, user_id, first_name, last_name, email, cell_num, active)
values ('b0100000-0000-4000-8000-000000000021', 'b0100000-0000-4000-8000-000000000013', 'Fixture', 'Instructor', 'instructor@example.test', '0000000013', true),
       ('b0100000-0000-4000-8000-000000000041', null, 'Fixture', 'Co-Instructor', 'co-instructor@example.test', '0000000041', true),
       ('b0100000-0000-4000-8000-000000000042', null, 'Fixture', 'Unauthorized', 'unauthorized-instructor@example.test', '0000000042', true),
       ('b0100000-0000-4000-8000-000000000043', null, 'Fixture', 'Inactive', 'inactive-instructor@example.test', '0000000043', false),
       ('b0100000-0000-4000-8000-000000000044', null, 'Fixture', 'Standby', 'standby-instructor@example.test', '0000000044', true);

insert into public.locations (id, name, address)
values ('b0100000-0000-4000-8000-000000000022', 'Fixture Training Room', '1 Example Way'),
       ('b0100000-0000-4000-8000-000000000051', 'Fixture Skills Lab', '2 Example Way');

insert into public.courses (id, course_title, course_description, course_price, printed_material_fee)
values ('b0100000-0000-4000-8000-000000000023', 'Fixture Clinical Skills', 'Synthetic course for local development.', 100.00, 150.00);

insert into public.instructor_courses (id, instructor_id, course_id)
values ('b0100000-0000-4000-8000-000000000024', 'b0100000-0000-4000-8000-000000000021', 'b0100000-0000-4000-8000-000000000023'),
       ('b0100000-0000-4000-8000-000000000045', 'b0100000-0000-4000-8000-000000000041', 'b0100000-0000-4000-8000-000000000023'),
       ('b0100000-0000-4000-8000-000000000046', 'b0100000-0000-4000-8000-000000000043', 'b0100000-0000-4000-8000-000000000023'),
       ('b0100000-0000-4000-8000-000000000047', 'b0100000-0000-4000-8000-000000000044', 'b0100000-0000-4000-8000-000000000023');

insert into public.course_sessions (
  id, course_id, location_id, start_date, end_date, start_time, end_time, max_students,
  status, cancelled_at, cancellation_reason
)
values ('b0100000-0000-4000-8000-000000000025', 'b0100000-0000-4000-8000-000000000023', 'b0100000-0000-4000-8000-000000000022',
        current_date + 30, current_date + 30, '09:00', '12:00', 20, 'scheduled', null, null),
       ('b0100000-0000-4000-8000-000000000052', 'b0100000-0000-4000-8000-000000000023', 'b0100000-0000-4000-8000-000000000051',
        current_date + 45, current_date + 46, '08:30', '16:00', 2, 'scheduled', null, null),
       ('b0100000-0000-4000-8000-000000000053', 'b0100000-0000-4000-8000-000000000023', 'b0100000-0000-4000-8000-000000000022',
        current_date + 20, current_date + 20, '13:00', '16:00', 12, 'scheduled', null, null),
       ('b0100000-0000-4000-8000-000000000073', 'b0100000-0000-4000-8000-000000000023', 'b0100000-0000-4000-8000-000000000051',
        current_date + 60, current_date + 60, '09:00', '12:00', 8, 'scheduled', null, null);

insert into public.session_instructors (course_session_id, instructor_id)
values ('b0100000-0000-4000-8000-000000000025', 'b0100000-0000-4000-8000-000000000021'),
       ('b0100000-0000-4000-8000-000000000025', 'b0100000-0000-4000-8000-000000000041'),
       ('b0100000-0000-4000-8000-000000000052', 'b0100000-0000-4000-8000-000000000044'),
       ('b0100000-0000-4000-8000-000000000053', 'b0100000-0000-4000-8000-000000000044'),
       ('b0100000-0000-4000-8000-000000000073', 'b0100000-0000-4000-8000-000000000044');

update public.course_sessions
set status = 'cancelled', cancelled_at = now(), cancellation_reason = 'Fixture venue unavailable'
where id = 'b0100000-0000-4000-8000-000000000053';

insert into public.material_types (id, name, kind, fee)
values ('b0100000-0000-4000-8000-000000000033', 'Electronic', 'electronic', 0),
       ('b0100000-0000-4000-8000-000000000061', 'Printed', 'printed', 0);

insert into public.bookings (
  id, user_id, course_session_id, material_type_id, booking_status, created_at
)
values ('b0100000-0000-4000-8000-000000000037', 'b0100000-0000-4000-8000-000000000012', 'b0100000-0000-4000-8000-000000000025', 'b0100000-0000-4000-8000-000000000033', 'Cancelled', now() - interval '2 days'),
       ('b0100000-0000-4000-8000-000000000034', 'b0100000-0000-4000-8000-000000000012', 'b0100000-0000-4000-8000-000000000025', 'b0100000-0000-4000-8000-000000000033', 'Confirmed', now()),
       ('b0100000-0000-4000-8000-000000000054', 'b0100000-0000-4000-8000-000000000012', 'b0100000-0000-4000-8000-000000000053', 'b0100000-0000-4000-8000-000000000033', 'Class Cancelled', now() - interval '1 day'),
       ('b0100000-0000-4000-8000-000000000071', 'b0100000-0000-4000-8000-000000000014', 'b0100000-0000-4000-8000-000000000073', 'b0100000-0000-4000-8000-000000000061', 'Pending', now()),
       ('b0100000-0000-4000-8000-000000000072', 'b0100000-0000-4000-8000-000000000012', 'b0100000-0000-4000-8000-000000000073', 'b0100000-0000-4000-8000-000000000033', 'Pending', now() - interval '4 days');

-- The insert trigger always starts a fresh 72-hour hold, so lapse this one afterwards.
update public.bookings set expires_at = now() - interval '1 day' where id = 'b0100000-0000-4000-8000-000000000072';

insert into public.payments (id, booking_id, amount, payment_date, payment_status_id)
select fixture.id, fixture.booking_id, 100.00, fixture.paid_at, ps.id
from (values
  ('b0100000-0000-4000-8000-000000000038'::uuid, 'b0100000-0000-4000-8000-000000000037'::uuid, null::timestamp, 'Failed'),
  ('b0100000-0000-4000-8000-000000000035'::uuid, 'b0100000-0000-4000-8000-000000000034'::uuid, now()::timestamp, 'Paid'),
  ('b0100000-0000-4000-8000-000000000055'::uuid, 'b0100000-0000-4000-8000-000000000054'::uuid, now()::timestamp, 'Paid')
) as fixture(id, booking_id, paid_at, status)
join public.payment_statuses ps on ps.name = fixture.status;

insert into public.course_session_changes (course_session_id, change, previous, current, changed_by)
values ('b0100000-0000-4000-8000-000000000053', 'cancelled',
        '{"status": "scheduled", "bookings": [{"booking_id": "b0100000-0000-4000-8000-000000000054", "booking_status": "Confirmed"}]}',
        '{"status": "cancelled", "reason": "Fixture venue unavailable"}',
        'b0100000-0000-4000-8000-000000000011');

insert into public.certificates (id, booking_id, certificate_number, issue_date)
values ('b0100000-0000-4000-8000-000000000036', 'b0100000-0000-4000-8000-000000000034', 'FIXTURE-B01-001', current_date);

commit;
