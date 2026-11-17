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
join public.courses c on c.id = b.course_session_id
join public.payments p on p.booking_id = b.id
join public.certificates cert on cert.booking_id = b.id;
```

The migration captures the shared project's application tables, constraints, grants and existing RLS policies. The CLI supplies the platform schemas, Auth tables, and standard extensions. Application schema corrections, including the destination of the booking foreign key, and RLS hardening are tracked separately.

## Backup and recovery preparation

For a disposable local database, recover with `supabase db reset --local` and rerun the verification query. If local changes matter, save a PostgreSQL logical backup to a private path outside the repository before resetting, then rehearse its restore into a separate disposable local database.

For the shared project, confirm the available backup or PITR window, recovery objectives, restore permissions, and the impact on writes before any hosted recovery. Record the intended restore point and rehearse in an isolated environment with authorized access. Database backups cover Storage metadata, so plan separately for the underlying Storage files and any external integrations. Verify schema and migration history, Auth, access policies, Storage and critical application workflows before reopening writes. Keep backup files and connection credentials out of Git. See [Supabase backup and restore documentation](https://supabase.com/docs/guides/platform/backups).
