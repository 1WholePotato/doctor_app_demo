# Local Supabase database

Install the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) and start a Docker-compatible container runtime. From `doctor_website_demo/` run:

```sh
supabase start
supabase db reset --local
```

The reset discards local database changes, applies the versioned migrations, and loads `supabase/seed.sql`. Use this reset for B01 fixtures. The legacy `npm run seed` script belongs to a separate workflow.

For the frontend, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in an untracked `.env.local` using the local API URL and anon key from `supabase status`. Run `npm ci` and `npm run dev`. Use `admin@example.test`, `student@example.test` or `instructor@example.test` with the local fixture password `LocalDemo-B01!`.

## Verify a rebuild

Run the following against the loopback database after each reset. The query should return one row with the student, course, payment amount `100.00` and certificate `FIXTURE-B01-001`.

```sql
select u.email, c.course_title, p.amount, cert.certificate_number
from public.bookings b
join public.users u on u.id = b.user_id
join public.course_sessions cs on cs.id = b.course_session_id
join public.courses c on c.id = cs.course_id
join public.payments p on p.booking_id = b.id
join public.certificates cert on cert.booking_id = b.id;
```

The baseline migration captures the shared project's application tables, constraints, grants and existing RLS policies. The CLI supplies the platform schemas, Auth tables, and standard extensions. RLS hardening is tracked separately.

## Bookings, sessions and review flags

Each booking points at one scheduled class through `bookings.course_session_id`, which references `course_sessions`. Booking state is `bookings.booking_status`, a name from `booking_statuses`. Payment state lives only on `payments.payment_status_id`. A student can hold one `Pending`, `Confirmed` or `Completed` booking per session. Cancelled attempts stay as separate rows.

The `20261118090000_booking_session_linkage` migration reconciled bookings created before this rule. Rows it could not resolve on its own sit in `booking_review_flags`, which only the service role can read. To resolve an `ambiguous_session` or `duplicate_active_booking` flag, set the booking's `course_session_id` (or cancel it after linking) and stamp `resolved_at`. Once no booking has a null session, run `alter table public.bookings validate constraint bookings_course_session_required;`.

## Class instructors

A scheduled class can have several instructors. Each assignment is a row in `session_instructors (course_session_id, instructor_id)`, and the primary key rejects assigning the same instructor twice. A trigger rejects an instructor who is inactive or has no `instructor_courses` row for the class's course. Admins change a class's instructors through `set_session_instructors(class_id, instructor_ids)`, which replaces the whole set in one transaction and refuses an empty set. Signed-in users can read assignments. Only that function and the service role write them.

Deactivating an instructor or removing their course authorization keeps their existing assignments. `stale_session_instructors`, readable only by the service role, lists each kept assignment whose instructor is no longer active and authorized, with the reason. The `20261118100000_session_instructors` migration moved each class's single `course_sessions.instructor_id` into `session_instructors` before dropping that column, so legacy classes taught by an unauthorized instructor also appear there. It also linked `instructors.user_id` to the `users` row whose email matches ignoring case and spaces, so later email changes keep the instructor tied to the same account.

## Classes

A class is a `course_sessions` row with a location, start and end dates, daily start and end times, a capacity (`max_students`) and its teachers in `session_instructors`. Its `status` is `scheduled` or `cancelled`, and cancelled is final. A cancelled class records `cancelled_at` and `cancellation_reason`. A moved class records `rescheduled_at`. Students see "Rescheduled" only on bookings made before that move.

Admins change classes through three functions, each one transaction:

- `schedule_class` inserts the class and all its teachers, or nothing if any teacher is refused or a range is invalid. A class cannot start in the past.
- `reschedule_class` changes location, dates, times or capacity. It refuses a cancelled class and a new start date in the past.
- `cancel_class` needs a reason. It marks every active booking `Class Cancelled`, keeps bookings and payments for refunds, and returns how many bookings it changed. Cancelling twice changes nothing.

Capacity rules live in triggers, so they hold for direct writes too. A booking takes a seat while it is `Pending`, `Confirmed` or `Completed`. A seat-taking booking locks its class row, then needs a scheduled class with a free seat. Capacity cannot drop below the seats taken. A class with active bookings cannot be marked cancelled directly, and a cancelled class refuses any update, new bookings and changes to its teachers. Only `cancel_class` moves those bookings out of the way first.

`course_session_changes` logs each reschedule and cancellation with the previous and new values, the admin and the time. A cancellation also lists each affected booking and its previous status. Only the service role can read it.

## Material fees and booking prices

Each material type is `electronic` or `printed` (`material_types.kind`). Electronic material is free. Each course sets its own printed fee in `courses.printed_material_fee`, which admins edit with the course. `material_types.fee` is no longer used for pricing.

A booking must choose an active material type. On insert, the `price_booking` trigger overwrites whatever the caller sent: `course_price` comes from the class's course, `material_fee` is zero for electronic material or the course's printed fee, and `total_amount` is their sum. Later edits to course prices, printed fees or material types leave existing bookings unchanged. Signed-in callers, admins included, and anonymous callers cannot change a booking's material or amounts afterwards. They can move a booking to another class of the same course, but not to a class of a different course, and they cannot give a class to a booking that has none. The service role and `security definer` functions can do all of these, which is how a flagged booking gets linked to its class, and a check keeps `total_amount = course_price + material_fee` for every row.

The `20261118142400_material_fees` migration marked free material types `electronic` and paid ones `printed`, gave every course the fee of the active printed type (or zero), and set each existing booking's `course_price` to `total_amount - material_fee`, so no booking's amounts changed.

## Database tests

`supabase test db` runs the pgTAP files in `supabase/tests/` against the seeded database. To rehearse the reconciliation on legacy-shaped rows, run:

```sh
supabase db reset --local --no-seed --version 20261117190000
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/checks/legacy_bookings.sql
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/checks/legacy_instructors.sql
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/checks/legacy_material_types.sql
supabase migration up --local
supabase test db supabase/checks/legacy_reconciliation.test.sql
supabase test db supabase/checks/legacy_session_instructors.test.sql
supabase test db supabase/checks/legacy_material_fees.test.sql
supabase db reset --local
```

`supabase/checks/class_capacity_race.sh` races two `psql` connections for the last seat and against a capacity cut, and fails if occupancy ever exceeds capacity. Run it against a freshly seeded database with the `PG*` variables pointing at the local stack, as `.github/workflows/local-database.yml` does.

To rehearse the class migration on legacy rows, where `course_sessions.active = false` becomes a cancelled class and its active bookings become `Class Cancelled`, run:

```sh
supabase db reset --local --no-seed --version 20261118100000
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/checks/legacy_classes.sql
supabase migration up --local
supabase test db supabase/checks/legacy_classes.test.sql
supabase db reset --local
```

## Backup and recovery preparation

For a disposable local database, recover with `supabase db reset --local` and rerun the verification query. If local changes matter, save a PostgreSQL logical backup to a private path outside the repository before resetting, then rehearse its restore into a separate disposable local database.

For the shared project, confirm the available backup or PITR window, recovery objectives, restore permissions, and the impact on writes before any hosted recovery. Record the intended restore point and rehearse in an isolated environment with authorized access. Database backups cover Storage metadata, so plan separately for the underlying Storage files and any external integrations. Verify schema and migration history, Auth, access policies, Storage and critical application workflows before reopening writes. Keep backup files and connection credentials out of Git. See [Supabase backup and restore documentation](https://supabase.com/docs/guides/platform/backups).
