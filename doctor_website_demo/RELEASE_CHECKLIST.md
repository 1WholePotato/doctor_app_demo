# Check a MedLearn release candidate

Use this checklist to record evidence for a specific commit and target environment. The current app is a RAD demo. RLS is intentionally disabled, and production gates remain open. This document does not authorize hosted changes, SQL execution, seeding, or deployment.

Leave a box unchecked until the owner records the result, date, commit, and environment. Label a skipped check with its reason. Store no credentials or personal data in the evidence.

## Local cleanup verification — 17 October 2026

Source candidate: `0501212ce471dd006f57bdfa65c43bf2e2ea32c6`, checked locally with Node `24.22.0` and npm `11.19.1`.

- A clean `npm ci` completed for the refreshed lockfile. `npm run verify` passed ESLint, 31 Vitest tests, 4 offline seed tests, TypeScript checks, and the production build.
- `npm audit` reported zero advisories for that lockfile on this date. This result does not establish application or database security.
- Synthetic browser checks reproduced and verified the Auth callback lock fix, delayed recovery-page loading, password submission, profile saves, token refresh during a save, and background refresh during a pending email change. Eight admin session scenarios checked input preservation, retry, duplicate-submit prevention, and warnings after partial success.
- Desktop and phone checks covered public pages, missing pages, and signed-out redirects. Recovery forms fit narrow screens after the mobile layout correction.

These results cover local code and synthetic responses. Hosted email delivery, database constraints and policies, live seeding, deployment, and production approval remain unchecked below.

## Record the candidate and local checks

- [ ] Record the candidate commit, reviewer, target environment, and Node/npm versions. Use a Node version supported by the [app setup guide](README.md).
- [ ] From `doctor_website_demo/`, run `npm ci` and `npm run verify`. Record each result. Verification includes lint, unit tests, offline seed tests, TypeScript checks, and the production build.
- [ ] Review the lockfile's dependency advisories with a fresh `npm audit`. Assess the affected paths and record fixes or explicit decisions. Earlier audit counts are historical, not current results.
- [ ] Confirm that environment files and private credentials are absent from tracked files and the built bundle. Resolve any previously exposed credentials through the credential owner's rotation process.

## Check a hosted demo before sharing

Use synthetic accounts and data in an approved disposable project. These checks do not permit production use while the production gates below remain open.

- [ ] Confirm the project's schema, role IDs, and booking FK mapping. Record the actual relationships rather than inferring them from column names.
- [ ] Configure build-time public `VITE_*` values and the host's app root, build command, and publish directory from the [setup guide](README.md).
- [ ] Verify HTTPS and SPA fallback on the deployed host. Directly open and refresh `/login`, `/reset`, `/admin/users`, and a real `/courses/:id` path. Confirm that static assets load and client routing handles access.
- [ ] Confirm the Supabase Site URL, exact `/reset` redirect URLs, email settings, and templates for this origin. Test real email delivery with a test mailbox.
- [ ] Test registration with email confirmation required, confirmation return, sign in, wrong credentials, and duplicate signup. Verify that Auth and `users` profile state remain consistent when profile creation fails.
- [ ] Test password recovery through the received email, password update, and sign in with the new password. Test expired and reused links and direct `/reset` access without recovery state.
- [ ] Test profile edits and email changes through confirmation. Confirm that the Auth email and profile email converge. Check the visible result of a failed profile write or email update.
- [ ] Test logged-out route access, each allowed role, wrong-role access, inactive users, refresh with a session, lookup failures, and sign out. Record browser results separately from database authorization results.
- [ ] Test course/session creation and role/instructor assignment, including failure after an earlier write succeeds. Confirm that users can see and recover from partial state.
- [ ] Check desktop and phone layouts, keyboard navigation, dialog focus and dismissal, form labels, contrast, loading states, empty states, and query failures.
- [ ] Confirm that disabled booking and roster downloads explain their limits. Confirm that grade and PDF screens label demo output and do not imply official completion or durable upload.
- [ ] Replace or approve doctor details, landing counts, and assets before public presentation. Identify placeholder screens in the demo handoff.

## Close production gates before using real data

These are future production requirements. Keep RLS unchanged during the current RAD work. Review, approve, and validate database changes separately before applying them.

- [ ] Create a versioned, repeatable database migration path with rollback or recovery instructions. Rehearse it against a disposable copy before a production change.
- [ ] Replace the draft policy scripts with reviewed least-privilege grants and RLS policies for every exposed table. Remove broad development policies explicitly. Adding restrictive policies does not cancel existing permissive policies.
- [ ] Verify database access directly with anonymous, student, instructor, and admin credentials. Test denied reads and writes against another user's rows, profile `role_id` and `active`, instructor assignments, and booking payment state. Do not rely on hidden UI controls.
- [ ] Move profile provisioning and privileged role, activation, and assignment changes to trusted database or server operations. Reject user-editable metadata as authority for privileged roles. Make related writes atomic or provide tested rollback.
- [ ] Limit access to identity and professional registration data. Define collection, retention, deletion, audit logging, and backup/restore requirements before collecting real personal data.
- [ ] Establish a booking FK to an individual session, migrate existing data, prevent duplicate bookings, and enforce capacity atomically. Verify session-specific seats, attendee lists, and exports against persisted records.
- [ ] Implement the payment lifecycle in a trusted service. Verify provider callbacks and retries. Prevent browser clients from marking bookings paid. Reconcile dashboard amounts with provider records before treating them as revenue.
- [ ] Persist authoritative grades/completion records before issuing official certificates. Authorize issuance and downloads on the server. Add private storage or scoped URLs and a trusted R2 upload path if durable certificates are required.
- [ ] Add and run automated checks for critical Auth, authorization, booking, and payment behavior. Offline regression tests do not establish hosted authorization, booking, or payment guarantees. Agree on required checks before merging future production changes.
- [ ] Record deployed origin, build variables by name only, migration version, access-control evidence, monitoring, support ownership, and deployment rollback steps. Obtain the release owner's production approval against that evidence.

## Record verification limits

Local builds and tests use the application source and synthetic backend fixtures. They do not verify email delivery, deployed schema, effective RLS policies, payment, storage, or production hosting. Attach results for the exact candidate and environment before checking any release box.

## Track remaining demo defects

The release cleanup identified these existing issues that still need a focused fix and browser verification:

- The Add Course form freezes its values and dismissal after a setup failure. Its draft retry logic avoids duplicate writes, but a permanently invalid submission has no correction path. Preserve duplicate protection when adding editable recovery or cancellation.
- Admin dialogs do not contain or restore keyboard focus consistently. Verify initial focus, Tab containment, Escape behavior, and focus restoration for Add Course, Add Session, and Change Role.

These issues are separate from the production authorization and transaction work above.
