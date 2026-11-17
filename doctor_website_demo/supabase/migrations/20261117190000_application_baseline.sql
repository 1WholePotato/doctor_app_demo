-- Hosted public schema baseline from PostgreSQL catalog metadata.
-- Supabase provisions auth.users and the API roles before this migration.

create table public."booking_statuses" (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null
);

create table public."bookings" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "course_session_id" uuid not null,
  "material_fee" numeric(10,2) default 0 not null,
  "total_amount" numeric(10,2) not null,
  "payment_status" text default 'pending'::text not null,
  "created_at" timestamp without time zone default now(),
  "material_type_id" uuid,
  "booking_status_id" uuid
);

create table public."certificates" (
  "id" uuid default gen_random_uuid() not null,
  "booking_id" uuid not null,
  "certificate_number" text not null,
  "issue_date" date not null,
  "expiry_date" date,
  "certificate_url" text,
  "created_at" timestamp without time zone default now()
);

create table public."course_sessions" (
  "id" uuid default gen_random_uuid() not null,
  "course_id" uuid not null,
  "instructor_id" uuid not null,
  "location_id" uuid not null,
  "start_date" date not null,
  "start_time" time without time zone not null,
  "end_date" date not null,
  "end_time" time without time zone not null,
  "max_students" integer default 20 not null,
  "active" boolean default true not null,
  "created_at" timestamp without time zone default now()
);

create table public."courses" (
  "id" uuid default gen_random_uuid() not null,
  "course_title" text not null,
  "course_description" text not null,
  "course_price" numeric(10,2) not null,
  "active" boolean default true not null,
  "created_at" timestamp without time zone default now()
);

create table public."instructor_courses" (
  "id" uuid default gen_random_uuid() not null,
  "instructor_id" uuid not null,
  "course_id" uuid not null,
  "created_at" timestamp with time zone default now() not null
);

create table public."instructors" (
  "id" uuid default gen_random_uuid() not null,
  "first_name" text not null,
  "last_name" text not null,
  "email" text not null,
  "cell_num" text not null,
  "active" boolean default true not null,
  "created_at" timestamp without time zone default now()
);

create table public."locations" (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null,
  "address" text
);

create table public."material_types" (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null,
  "fee" numeric(10,2) default 0 not null,
  "active" boolean default true not null,
  "created_at" timestamp without time zone default now()
);

create table public."payment_statuses" (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null
);

create table public."payments" (
  "id" uuid default gen_random_uuid() not null,
  "booking_id" uuid not null,
  "ozow_transaction_id" text,
  "amount" numeric(10,2) not null,
  "payment_date" timestamp without time zone,
  "created_at" timestamp without time zone default now(),
  "payment_status_id" uuid
);

create table public."roles" (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null
);

create table public."users" (
  "id" uuid not null,
  "role_id" uuid not null,
  "first_name" text not null,
  "last_name" text not null,
  "birth_date" date not null,
  "id_num" text,
  "passport_num" text,
  "cell_num" text not null,
  "email" text not null,
  "sanc_num" text not null,
  "active" boolean default true not null,
  "created_at" timestamp without time zone default now()
);

alter table public."booking_statuses" add constraint "booking_statuses_name_key" UNIQUE (name);
alter table public."booking_statuses" add constraint "booking_statuses_pkey" PRIMARY KEY (id);
alter table public."bookings" add constraint "bookings_material_fee_check" CHECK ((material_fee >= (0)::numeric));
alter table public."bookings" add constraint "bookings_pkey" PRIMARY KEY (id);
alter table public."bookings" add constraint "bookings_total_amount_check" CHECK ((total_amount >= (0)::numeric));
alter table public."certificates" add constraint "certificates_certificate_number_key" UNIQUE (certificate_number);
alter table public."certificates" add constraint "certificates_pkey" PRIMARY KEY (id);
alter table public."users" add constraint "chk_id_or_passport" CHECK ((((id_num IS NOT NULL) AND (passport_num IS NULL)) OR ((id_num IS NULL) AND (passport_num IS NOT NULL))));
alter table public."course_sessions" add constraint "course_sessions_pkey" PRIMARY KEY (id);
alter table public."courses" add constraint "courses_course_price_check" CHECK ((course_price >= (0)::numeric));
alter table public."courses" add constraint "courses_pkey" PRIMARY KEY (id);
alter table public."instructor_courses" add constraint "instructor_courses_instructor_id_course_id_key" UNIQUE (instructor_id, course_id);
alter table public."instructor_courses" add constraint "instructor_courses_pkey" PRIMARY KEY (id);
alter table public."instructors" add constraint "instructors_pkey" PRIMARY KEY (id);
alter table public."locations" add constraint "locations_pkey" PRIMARY KEY (id);
alter table public."material_types" add constraint "material_types_name_key" UNIQUE (name);
alter table public."material_types" add constraint "material_types_pkey" PRIMARY KEY (id);
alter table public."payment_statuses" add constraint "payment_statuses_name_key" UNIQUE (name);
alter table public."payment_statuses" add constraint "payment_statuses_pkey" PRIMARY KEY (id);
alter table public."payments" add constraint "payments_pkey" PRIMARY KEY (id);
alter table public."roles" add constraint "roles_name_key" UNIQUE (name);
alter table public."roles" add constraint "roles_pkey" PRIMARY KEY (id);
alter table public."users" add constraint "users_email_key" UNIQUE (email);
alter table public."users" add constraint "users_pkey" PRIMARY KEY (id);
alter table public."bookings" add constraint "bookings_booking_status_id_fkey" FOREIGN KEY (booking_status_id) REFERENCES public.booking_statuses(id);
alter table public."bookings" add constraint "bookings_material_type_id_fkey" FOREIGN KEY (material_type_id) REFERENCES public.material_types(id);
alter table public."certificates" add constraint "certificates_booking_id_fkey" FOREIGN KEY (booking_id) REFERENCES public.bookings(id);
alter table public."course_sessions" add constraint "course_sessions_course_id_fkey" FOREIGN KEY (course_id) REFERENCES public.courses(id);
alter table public."course_sessions" add constraint "course_sessions_instructor_id_fkey" FOREIGN KEY (instructor_id) REFERENCES public.instructors(id);
alter table public."course_sessions" add constraint "course_sessions_location_id_fkey" FOREIGN KEY (location_id) REFERENCES public.locations(id);
alter table public."bookings" add constraint "fk_booking_course" FOREIGN KEY (course_session_id) REFERENCES public.courses(id) ON DELETE CASCADE;
alter table public."bookings" add constraint "fk_booking_user" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
alter table public."users" add constraint "fk_users_roles" FOREIGN KEY (role_id) REFERENCES public.roles(id);
alter table public."instructor_courses" add constraint "instructor_courses_course_id_fkey" FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;
alter table public."instructor_courses" add constraint "instructor_courses_instructor_id_fkey" FOREIGN KEY (instructor_id) REFERENCES public.instructors(id) ON DELETE CASCADE;
alter table public."payments" add constraint "payments_booking_id_fkey" FOREIGN KEY (booking_id) REFERENCES public.bookings(id);
alter table public."payments" add constraint "payments_payment_status_id_fkey" FOREIGN KEY (payment_status_id) REFERENCES public.payment_statuses(id);
alter table public."users" add constraint "users_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

grant delete, insert, references, select, trigger, truncate, update
  on table public."booking_statuses" to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update
  on table public."bookings" to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update
  on table public."certificates" to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update
  on table public."course_sessions" to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update
  on table public."courses" to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update
  on table public."instructor_courses" to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update
  on table public."instructors" to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update
  on table public."locations" to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update
  on table public."material_types" to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update
  on table public."payment_statuses" to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update
  on table public."payments" to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update
  on table public."roles" to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update
  on table public."users" to anon, authenticated, service_role;

alter table public.instructor_courses enable row level security;

create policy "instructor_courses_write_authenticated" on public."instructor_courses"
  as permissive for all to authenticated
  using (true) with check (true);

create policy "instructor_courses_select_authenticated" on public."instructor_courses"
  as permissive for select to authenticated
  using (true);
