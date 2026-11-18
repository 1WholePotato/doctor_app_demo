# Payments with Ozow

A student pays a held booking through Ozow's Hosted Checkout on [One API](https://hub.ozow.com/integration-methods/apis/money-in/hosted-checkout/). The browser never sees Ozow credentials and never sends an amount or a reference. A booking becomes paid only when Ozow's API confirms a matching transaction, never from a notification body or the browser coming back.

## Flow

1. The student clicks **Pay** on a held booking (course page or My courses). The app calls the `ozow-checkout` Edge Function with `{ bookingId }` and the student's session.
2. The function resolves the student from their JWT, then calls `begin_payment_attempt(booking, student)` with the service role. It locks the booking and refuses a booking that belongs to someone else (403), is not `Pending` (409), has a lapsed or missing hold expiry (409), or has nothing to pay (409). It returns the booking's open attempt, or creates one with the booking's stored `total_amount` and `expires_at`.
3. If the attempt already has an Ozow URL, the function returns it. Otherwise it gets a One API token (`payments` scope) and calls `POST /payments` with `Idempotency-Key` set to the attempt id. It sends the attempt's reference as `merchantReference` and `beneficiaryReference`, its amount, `expireAt` equal to the hold expiry, `returnUrl` `$APP_URL/payments/return?booking=<id>`, and `notifyUrl` `$SUPABASE_URL/functions/v1/ozow-notify`.
4. The function stores Ozow's payment id and `redirectUrl` on the attempt and returns the URL. The app sends the browser there.
5. Ozow posts a notification to `ozow-notify` and returns the student to `/payments/return`. That page reads the booking and its attempts from the database and shows paid, under review, not confirmed yet, did not go through, hold expired, or closed. It ignores every query parameter except `booking` and writes nothing.

## Confirming payments

Ozow sends the `notifyUrl` the [same form the Payments API posts](https://hub.ozow.com/api-reference/payments-api/webhooks/transaction-notification/), signed with a SHA512 hash over a Payments API private key ([Hosted Checkout, "There are two ways to be told"](https://hub.ozow.com/integration-methods/apis/money-in/hosted-checkout/)). A One API client has no such key, so the notification cannot be authenticated. One API's own webhooks are Svix-signed, but they need a subscription per client. Both are treated the same way: as a hint to go and ask Ozow.

```text
ozow-notify (no JWT)                  form field TransactionReference, nothing else is read
  unknown reference -> 404 · missing -> 400 · not POST -> 405 · Ozow not configured -> 503
  attempt by reference, whatever its status
  GET {OZOW_API_URL}/payments/{attempt.ozow_payment_id}/transactions   own bearer token
  settle_payment_attempt(ozow_payment_id, transactions) -> 200 { outcome }
  Ozow lookup fails -> 502, so Ozow retries

ozow-reconcile (Bearer = service role key)
  attempts with an Ozow payment that are open, or failed and expired less than a day ago
  the same lookup and settle for each -> 200 { checked, settled, failed }
```

`settle_payment_attempt` locks the class, the booking and the attempt, then applies Ozow's transactions. Statuses follow [Ozow's One API mapping](https://hub.ozow.com/integration-methods/statuses/): `Successful` is final and paid, `Error` is final and covers cancelled, abandoned, voided and failed, `Incomplete` and `Pending` are still in progress.

| Ozow reports | Effect |
|---|---|
| `Successful`, reference, `ZAR` amount, attempt amount and booking total all match, hold valid | booking `Confirmed`, attempt `paid`, one `Paid` payment |
| the same, hold lapsed, seat free | the same, outcome `late_paid` |
| the same, no seat, class cancelled, booking cancelled or student rebooked | `Paid` payment recorded, attempt `paid`, review flag `late_payment` |
| the same, booking already paid | `Paid` payment recorded, review flag `duplicate_payment` |
| `Successful` with any mismatch | nothing paid, review flag `payment_mismatch` |
| only `Error` transactions, or none and the attempt expired | attempt `failed`, booking `Expired`, seat released |
| `Incomplete` or `Pending` present | nothing changes yet |
| anything after `paid` | logged as `stale`, nothing changes |

Every transaction status is logged once in `payment_events`, unique on Ozow's transaction id and status, so a repeated or parallel notification has no second effect. The table is append-only: no API role writes it and a trigger refuses updates and deletes. Admins can read `payment_attempts` and `payment_events`. The review flags stay readable only by the service role until the admin permissions in #17 land.

The checkout keeps Ozow's payment id on an attempt even when that attempt failed while Ozow was creating the payment, so money paid on a link that was never handed out is still found.

## Payment attempts

`payment_attempts` holds one row per Ozow payment request: `reference` (`DA` and ten hex digits, inside Ozow's 20 letters and digits), `amount`, `expires_at`, `status` (`open` or `failed`), `ozow_payment_id` and `redirect_url`. A partial unique index allows one `open` attempt per booking, so retries and parallel clicks share it. If Ozow refuses the request, the attempt becomes `failed` and the next click starts a new attempt with a new reference.

Students can read the attempts on their own bookings. Only the service role writes them, and only the service role can execute `begin_payment_attempt`.

## Secrets

The functions read these from their environment. `supabase/functions/.env.example` lists them with empty values.

| Name | Value |
|---|---|
| `OZOW_API_URL` | `https://stagingone.ozow.com/v1` for staging, `https://one.ozow.com/v1` for production |
| `OZOW_CLIENT_ID`, `OZOW_CLIENT_SECRET` | A One API client with the `payments` scope (Ozow Dashboard, One API, Clients) |
| `OZOW_SITE_CODE` | The site code from the Ozow Dashboard, Sites |
| `APP_URL` | Public origin of the web app. Ozow refuses `localhost` return URLs |

Until all five are set `ozow-checkout` answers 503 and the app says online payment is not available yet. `ozow-notify` and `ozow-reconcile` need the four `OZOW_*` values. Set them on the hosted project with `supabase secrets set --env-file supabase/functions/.env`.

References are `DA` and ten hex digits, twelve characters. Ozow counts a site's configured reference prefix towards the 20-character `beneficiaryReference` limit ([OpenAPI document](https://hub.ozow.com/api-reference/specs/one-api.yaml), `PaymentRequest`), so a prefix longer than eight characters would make every payment request fail.

## Scheduled reconciliation

The `reconcile-ozow-payments` pg_cron job runs `request_payment_reconciliation()` every ten minutes. It calls `ozow-reconcile` through `pg_net` with two Vault secrets and does nothing until both exist:

```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<service role key>', 'service_role_key');
```

An admin can run the same check at any time with `curl -X POST -H "Authorization: Bearer <service role key>" https://<project-ref>.supabase.co/functions/v1/ozow-reconcile`.

## Local testing

`supabase/functions/tests/ozow-mock.ts` stands in for One API. It checks the bearer token, the `PaymentRequest` fields from Ozow's [OpenAPI document](https://hub.ozow.com/api-reference/specs/one-api.yaml), and `Idempotency-Key` replays. It lists a payment's transactions as `GET /payments/{id}/transactions` does (required `fromDate` and `toDate`, paging links, an empty list for an unknown payment). Its payment page completes or cancels the payment, posts the Payments API notification form to the notify URL, and redirects to the return URL. Set `OZOW_MOCK_NOTIFY_URL` when the payment's notify URL is only reachable from inside Docker. From `doctor_website_demo/`, with the local stack running:

```sh
supabase functions serve --env-file supabase/functions/tests/ozow-mock.env &
eval "$(supabase status -o env | sed 's/^/export /')"
cd supabase/functions
SUPABASE_URL="$API_URL" SUPABASE_ANON_KEY="$ANON_KEY" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" OZOW_MOCK_PORT=55590 \
  deno test --allow-net --allow-env tests/
```

For a manual run in the browser, start the mock with `OZOW_MOCK_NOTIFY_URL=http://127.0.0.1:54321/functions/v1/ozow-notify deno run --allow-net --allow-env tests/ozow-mock.ts` and the app on `http://127.0.0.1:5173`.

`supabase/checks/payment_attempt_race.sh` races twelve parallel attempt starts on one booking and expects one attempt. `supabase/checks/payment_settle_race.sh` races twelve duplicate settlements of one payment, and a late payment against six students for a class's last seat.
