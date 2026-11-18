begin;

insert into public.roles (id, name) values ('c0300000-0000-4000-8000-000000000001', 'student');

insert into auth.users (id, aud, role, email)
values ('c0300000-0000-4000-8000-000000000011', 'authenticated', 'authenticated', 'legacy-one@example.test'),
       ('c0300000-0000-4000-8000-000000000012', 'authenticated', 'authenticated', 'legacy-two@example.test');

insert into public.users (id, role_id, first_name, last_name, birth_date, passport_num, cell_num, email, sanc_num)
values ('c0300000-0000-4000-8000-000000000011', 'c0300000-0000-4000-8000-000000000001', 'Legacy', 'One', '1990-01-01', 'TEST-B03-ONE', '0000000311', 'legacy-one@example.test', 'TEST-B03-ONE'),
       ('c0300000-0000-4000-8000-000000000012', 'c0300000-0000-4000-8000-000000000001', 'Legacy', 'Two', '1990-01-01', 'TEST-B03-TWO', '0000000312', 'legacy-two@example.test', 'TEST-B03-TWO');

insert into public.instructors (id, first_name, last_name, email, cell_num)
values ('c0300000-0000-4000-8000-000000000021', 'Legacy', 'Instructor', 'legacy-instructor@example.test', '0000000321');

insert into public.locations (id, name) values ('c0300000-0000-4000-8000-000000000022', 'Legacy Room');

insert into public.courses (id, course_title, course_description, course_price)
values ('c0300000-0000-4000-8000-0000000000a1', 'One session', 'Legacy fixture', 100),
       ('c0300000-0000-4000-8000-0000000000a2', 'Two sessions', 'Legacy fixture', 100),
       ('c0300000-0000-4000-8000-0000000000a3', 'No sessions', 'Legacy fixture', 100);

insert into public.course_sessions (id, course_id, instructor_id, location_id, start_date, end_date, start_time, end_time)
values ('c0300000-0000-4000-8000-0000000000b1', 'c0300000-0000-4000-8000-0000000000a1', 'c0300000-0000-4000-8000-000000000021', 'c0300000-0000-4000-8000-000000000022', '2026-12-01', '2026-12-01', '09:00', '12:00'),
       ('c0300000-0000-4000-8000-0000000000b2', 'c0300000-0000-4000-8000-0000000000a2', 'c0300000-0000-4000-8000-000000000021', 'c0300000-0000-4000-8000-000000000022', '2026-12-02', '2026-12-02', '09:00', '12:00'),
       ('c0300000-0000-4000-8000-0000000000b3', 'c0300000-0000-4000-8000-0000000000a2', 'c0300000-0000-4000-8000-000000000021', 'c0300000-0000-4000-8000-000000000022', '2026-12-09', '2026-12-09', '09:00', '12:00');

insert into public.booking_statuses (id, name) values ('c0300000-0000-4000-8000-000000000031', 'Confirmed');
insert into public.payment_statuses (id, name) values ('c0300000-0000-4000-8000-000000000032', 'Paid');

insert into public.bookings (id, user_id, course_session_id, total_amount, payment_status, booking_status_id, created_at)
values
  ('c0300000-0000-4000-8000-0000000000c1', 'c0300000-0000-4000-8000-000000000011', 'c0300000-0000-4000-8000-0000000000a1', 100, 'paid', 'c0300000-0000-4000-8000-000000000031', '2026-11-01'),
  ('c0300000-0000-4000-8000-0000000000c2', 'c0300000-0000-4000-8000-000000000011', 'c0300000-0000-4000-8000-0000000000a2', 100, 'pending', null, '2026-11-02'),
  ('c0300000-0000-4000-8000-0000000000c3', 'c0300000-0000-4000-8000-000000000012', 'c0300000-0000-4000-8000-0000000000a3', 100, 'pending', null, '2026-11-03'),
  ('c0300000-0000-4000-8000-0000000000c4', 'c0300000-0000-4000-8000-000000000012', 'c0300000-0000-4000-8000-0000000000a1', 100, 'passed', null, '2026-11-04'),
  ('c0300000-0000-4000-8000-0000000000c5', 'c0300000-0000-4000-8000-000000000012', 'c0300000-0000-4000-8000-0000000000a1', 100, 'failed', null, '2026-11-05'),
  ('c0300000-0000-4000-8000-0000000000c6', 'c0300000-0000-4000-8000-000000000011', 'c0300000-0000-4000-8000-0000000000a2', 100, 'paid', null, '2026-11-06');

insert into public.payments (id, booking_id, amount, payment_status_id)
values ('c0300000-0000-4000-8000-0000000000d1', 'c0300000-0000-4000-8000-0000000000c1', 100, 'c0300000-0000-4000-8000-000000000032'),
       ('c0300000-0000-4000-8000-0000000000d6', 'c0300000-0000-4000-8000-0000000000c6', 100, null);

insert into public.certificates (id, booking_id, certificate_number, issue_date)
values ('c0300000-0000-4000-8000-0000000000e4', 'c0300000-0000-4000-8000-0000000000c4', 'LEGACY-B03-004', '2026-11-10');

commit;
