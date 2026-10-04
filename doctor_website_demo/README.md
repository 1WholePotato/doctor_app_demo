# MedLearn CME demo

A continuing medical education app for a doctor's courses, built with React 19, TypeScript, Vite, React Router, and Supabase. The current build is a rapid application development (RAD) demo.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`. The app can read role IDs from the `roles` table; `VITE_STUDENT_ROLE_ID` and `VITE_ADMIN_ROLE_ID` provide explicit fallbacks. Never put a service role key or storage credentials in a `VITE_` variable. Keep `.env.local` out of version control.

Useful commands: `npm run build` for TypeScript and a production bundle, `npm run lint` for ESLint, and `npm run preview` to serve a built bundle. `npm run test` runs the existing Vitest suite.

## What the app does

| Area | Current flow |
| --- | --- |
| Public | Landing page, registration, sign in, password recovery. |
| Student | View active courses and enrolments, course details, profile, grades page, and notifications placeholder. |
| Admin | View dashboard metrics and upcoming sessions, manage courses and sessions, manage users' roles and instructor course assignments. |

Routes are defined in `src/App.tsx`. Authenticated pages use role-specific layouts and client-side route guards. The app uses the Supabase browser client for account and course data. A booking currently identifies a course through the reported `bookings.course_session_id` column; it does not identify a specific session.

## Demo boundaries

- RLS is intentionally disabled during RAD. Client-side route guards do not secure database access. Review and enable policies before using real personal or payment data; see the [V1 implementation plan](V1_IMPLEMENTATION_PLAN.md).
- Course booking and payment are not connected. Session-specific seats, attendee lists, and class list downloads require a booking-to-session relationship; the download control explains why it is disabled.
- Grades do not have an authoritative completion record. Missing results show as unavailable. Any generated certificate PDF is a local demo preview, not an official credential; R2 upload is deferred until there is a trusted server path.
- Settings and notifications include placeholder screens. Landing-page doctor details and counts are demo copy pending official assets and content.

## Demo data

`npm run seed` runs `scripts/seed-demo.mjs`. It requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`, without a `VITE_` prefix, and must only target a disposable project. To seed instructor assignments, first apply `scripts/ensure-instructor-courses.sql` to that project. Do not run the draft production RLS policy script during RAD.

The current work and deferred items are tracked in [V1_IMPLEMENTATION_PLAN.md](V1_IMPLEMENTATION_PLAN.md). `PRELIMINARY_PLAN.md` and `AUDIT_REPORT.md` describe earlier snapshots.
