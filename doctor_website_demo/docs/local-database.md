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

## Student registration

Registration sends the profile details as Auth sign-up metadata. A trigger on `auth.users` creates the matching `public.users` row with the student role in the same transaction. A sign-up with invalid details, or one that asks for a role, fails without creating an account. Accounts created without registration details, such as staff accounts from the dashboard, get no automatic profile. Clients cannot insert profiles directly.

Run the database assertions with `supabase test db`. To exercise real sign-ups, load the stack's keys and run the end-to-end script in the stack's confirmation mode:

```sh
set -a; eval "$(supabase status -o env | grep -E '^[A-Z_]+=')"; set +a
EXPECT_EMAIL_CONFIRMATION=false node --test scripts/test-registration-local.mjs
```

For the confirmation flow, restart with `SUPABASE_AUTH_EMAIL_ENABLE_CONFIRMATIONS=true supabase start` and run the script with `EXPECT_EMAIL_CONFIRMATION=true`. It confirms each account through the local Mailpit inbox.

## Password recovery and email changes

Auth owns the login email. A trigger on `auth.users` copies each confirmed email change to `public.users.email` in the same transaction, and clients cannot write that column. A requested change leaves both emails on the old address until the user opens the confirmation link. If the profile cannot take the new address, the confirmation fails and both stay unchanged.

To exercise reset links and email changes against the running stack, load its keys as above and run:

```sh
node --test scripts/test-recovery-email-local.mjs
```

It follows valid, reused, tampered and expired recovery links and confirmed email changes through the local Mailpit inbox. It marks a link expired by backdating `auth.users.recovery_sent_at` through `psql`, so `DB_URL` must point at the local database.

## Backup and recovery preparation

For a disposable local database, recover with `supabase db reset --local` and rerun the verification query. If local changes matter, save a PostgreSQL logical backup to a private path outside the repository before resetting, then rehearse its restore into a separate disposable local database.

For the shared project, confirm the available backup or PITR window, recovery objectives, restore permissions, and the impact on writes before any hosted recovery. Record the intended restore point and rehearse in an isolated environment with authorized access. Database backups cover Storage metadata, so plan separately for the underlying Storage files and any external integrations. Verify schema and migration history, Auth, access policies, Storage and critical application workflows before reopening writes. Keep backup files and connection credentials out of Git. See [Supabase backup and restore documentation](https://supabase.com/docs/guides/platform/backups).
