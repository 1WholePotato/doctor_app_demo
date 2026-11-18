begin;

insert into public.roles (id, name) values ('c0700000-0000-4000-8000-000000000001', 'student');

insert into auth.users (id, aud, role, email)
values ('c0700000-0000-4000-8000-000000000011', 'authenticated', 'authenticated', 'legacy-class@example.test');

insert into public.users (id, role_id, first_name, last_name, birth_date, passport_num, cell_num, email, sanc_num)
values ('c0700000-0000-4000-8000-000000000011', 'c0700000-0000-4000-8000-000000000001', 'Legacy', 'Class', '1990-01-01', 'TEST-B07-ONE', '0000000711', 'legacy-class@example.test', 'TEST-B07-ONE');

insert into public.locations (id, name) values ('c0700000-0000-4000-8000-000000000022', 'Legacy Class Room');

insert into public.courses (id, course_title, course_description, course_price)
values ('c0700000-0000-4000-8000-0000000000a1', 'Legacy classes', 'Legacy fixture', 100);

insert into public.course_sessions (id, course_id, location_id, start_date, end_date, start_time, end_time, max_students, active)
values ('c0700000-0000-4000-8000-0000000000b1', 'c0700000-0000-4000-8000-0000000000a1', 'c0700000-0000-4000-8000-000000000022', '2026-12-01', '2026-12-01', '09:00', '12:00', 20, true),
       ('c0700000-0000-4000-8000-0000000000b2', 'c0700000-0000-4000-8000-0000000000a1', 'c0700000-0000-4000-8000-000000000022', '2026-12-02', '2026-12-02', '09:00', '12:00', 20, false),
       ('c0700000-0000-4000-8000-0000000000b3', 'c0700000-0000-4000-8000-0000000000a1', 'c0700000-0000-4000-8000-000000000022', '2026-12-03', '2026-12-03', '09:00', '12:00', 20, false);

insert into public.bookings (id, user_id, course_session_id, total_amount, booking_status)
values ('c0700000-0000-4000-8000-0000000000c1', 'c0700000-0000-4000-8000-000000000011', 'c0700000-0000-4000-8000-0000000000b1', 100, 'Confirmed'),
       ('c0700000-0000-4000-8000-0000000000c2', 'c0700000-0000-4000-8000-000000000011', 'c0700000-0000-4000-8000-0000000000b2', 100, 'Confirmed'),
       ('c0700000-0000-4000-8000-0000000000c3', 'c0700000-0000-4000-8000-000000000011', 'c0700000-0000-4000-8000-0000000000b2', 100, 'Cancelled');

commit;
