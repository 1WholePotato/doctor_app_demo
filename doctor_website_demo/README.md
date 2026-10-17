# Run the MedLearn CME demo

This React 19, TypeScript, Vite, React Router, and Supabase app is a rapid application development demo. Use a disposable Supabase project with synthetic data. RLS is intentionally disabled during RAD. Follow the [release checklist](RELEASE_CHECKLIST.md) before considering production use.

## Install and configure

1. Use Node.js 24. The repository's `.nvmrc` pins 24.22.0. With nvm, run `nvm install` and `nvm use` from the repository root.
2. Enter the app directory with `cd doctor_website_demo`. All npm commands run from this directory.
3. Run `npm ci` to install the app's `package-lock.json`.
4. Run `cp .env.example .env.local` on first setup. Keep your existing local configuration if the file already exists.
5. Edit `.env.local` with the values for your demo project.

Configure the browser variables as follows:

- `VITE_SUPABASE_URL` is the project's public Supabase URL.
- `VITE_SUPABASE_ANON_KEY` is the project's public anon key. Never use a service role key here.
- `VITE_STUDENT_ROLE_ID` and `VITE_ADMIN_ROLE_ID` are optional explicit role IDs for your project's `roles` rows. Leave them blank to read `roles.id` and `roles.name`. Student and admin role resolution prefers a configured ID. The role-list loader also uses these variables as fallbacks when it cannot load roles.

Every `VITE_*` value is public browser configuration. Keep `.env.local` out of Git. Do not put service role keys, R2 credentials, or other private credentials in browser variables. Restart Vite after local changes. Rebuild the static bundle after changing hosted build variables.

## Prepare the demo project

The app expects an existing schema with `users`, `roles`, `courses`, `course_sessions`, `bookings`, `instructors`, `locations`, and `instructor_courses`. The seed script also uses `payments`. The repository does not provide a complete database bootstrap migration. Confirm the target schema and role rows with the project owner before connecting the app.

The current source treats `bookings.course_session_id` as a course relationship. The prior investigation reported that it references `courses.id`, despite its name. That mapping has not been rechecked against a live database in this documentation pass. It cannot identify an individual session for capacity or attendance.

Do not run `scripts/production-rls-policies.sql` as a setup step. It is a draft with unresolved authorization gaps. `scripts/ensure-instructor-courses.sql` is a development helper that enables RLS on that table and grants broad authenticated access. It is not a production security migration. Review any SQL separately before applying it to an explicitly selected disposable project.

## Configure Auth redirects

In the demo project's Supabase Auth URL configuration, set the Site URL to the app origin you are using. For local development, the configured origin is `http://localhost:5178`. For a hosted demo, use its HTTPS origin.

Add the exact recovery return URL for each origin to the redirect allowlist:

- `http://localhost:5178/reset` for the configured development port.
- `http://localhost:4173/reset` if you test the default Vite preview origin.
- `https://your-demo-host.example/reset` for your actual hosted demo domain.

Use the port printed by Vite if a configured port is occupied. An origin using `127.0.0.1` differs from one using `localhost`. Add only the return URLs for origins you use.

`ForgotPassword.tsx` requests `${window.location.origin}/reset`, and `App.tsx` handles `/reset`. Registration and profile email changes do not set an explicit email redirect URL. Check the project's Site URL, confirmation settings, and email templates for those flows. Use a reachable test mailbox and verify signup confirmation, password recovery, and email changes end to end. Source inspection and the current unit tests do not verify email delivery or callback behavior.

## Run and check

Run commands from this directory:

```bash
npm run dev
```

Open the URL Vite prints. The configured dev port is 5178. To check the app and serve its built bundle, run:

```bash
npm run verify
npm run preview
```

`verify` runs `lint`, `test`, `test:seed`, and `build` in sequence. `lint` runs ESLint, `test` runs Vitest, and `test:seed` checks seed requests against an offline fake backend. Vitest ignores local env files and supplies test-only values. No test needs a hosted project or service key. `build` runs `tsc -b` and Vite, then writes `dist/`. `preview` serves that output locally, normally on port 4173.

## Host the static bundle

Set the host's app root to `doctor_website_demo/`. Install with `npm ci`, build with `npm run build`, and publish that directory's `dist/`. If the host runs from the repository root, enter `doctor_website_demo/` before those commands and publish `doctor_website_demo/dist/`.

Supply the public `VITE_*` variables at build time. The current app assumes hosting at the domain root. Configure the host to serve existing static assets normally and rewrite other application paths to `/index.html` without changing the browser URL. No host-specific fallback configuration is checked in.

Before sharing a hosted demo, open and refresh `/login`, `/reset`, `/admin/users`, and `/courses/<existing-course-id>` directly. The host must serve the SPA, after which the client guard handles protected routes. A passing local preview does not prove the deployed host has the rewrite or correct Auth redirects. `npm run preview` is a local inspection server, not the deployment service.

## Respect the demo boundaries

- RLS remains intentionally disabled for RAD. Client-side role checks and route guards are usability controls, not database authorization. Do not enter real identity, medical, or payment data.
- Public screens include registration, sign in, and password recovery. Admin screens manage courses, sessions, users' roles, and instructor assignments. Student screens show the course catalog, enrolments, profile, and grades view. These are implemented screens, not verified end-to-end workflows.
- Booking and payment are not connected. "Book now" is disabled. Session-specific seats, rosters, and class list downloads require a booking-to-session relationship. Dashboard amounts are not verified payment accounting.
- Grades lack authoritative completion records. Generated certificate PDFs are local demo previews, not official credentials. There is no durable R2 upload path.
- Course/session creation and role/instructor assignment involve multiple client writes. Partial failure recovery does not provide a trusted transaction.
- Settings and notifications include placeholders. Landing-page doctor details and counts are demo copy pending approved content and assets.

## Handle seed data separately

`npm run seed` runs `scripts/seed-demo.mjs` and mutates the configured Supabase project. It creates or updates demo accounts, resets their passwords, confirms their emails, and writes catalog and booking data. It is not required to install, build, lint, or run tests.

Run it only against a disposable project after reviewing its schema assumptions. Add the seed-only settings from [scripts/.env.example](scripts/.env.example) to `.env.local` or your shell. Shell values override the file. Keep `SUPABASE_SERVICE_ROLE_KEY` local and never prefix it with `VITE_`.

Set `SEED_CONFIRM_URL` to exactly match `VITE_SUPABASE_URL`. Missing or mismatched confirmation stops the seed before any request. This confirms your chosen target; it cannot determine whether that project is disposable. The seed resolves or creates admin, student, and instructor roles before account writes.

Optionally set `SEED_SESSION_DATE` to a valid future UTC date in `YYYY-MM-DD` format. The default is seven days ahead. Rerunning updates matching demo session dates. The seed uses `bookings.course_session_id` with the course ID to match the current app contract. A seeded, already-confirmed account does not test email confirmation.

Use the [release checklist](RELEASE_CHECKLIST.md) for remaining gates and evidence. The [V1 implementation plan](V1_IMPLEMENTATION_PLAN.md) preserves the RAD work and deferred findings. `PRELIMINARY_PLAN.md`, `AUDIT_REPORT.md`, and root `IMPLEMENTATION.md` describe earlier snapshots.
