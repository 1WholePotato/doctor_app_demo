# Payments with Ozow

A student pays a held booking through Ozow's Hosted Checkout on [One API](https://hub.ozow.com/integration-methods/apis/money-in/hosted-checkout/). The browser never sees Ozow credentials and never sends an amount or a reference. A booking becomes paid only from a verified Ozow notification (issue #27), never from the browser coming back.

## Flow

1. The student clicks **Pay** on a held booking (course page or My courses). The app calls the `ozow-checkout` Edge Function with `{ bookingId }` and the student's session.
2. The function resolves the student from their JWT, then calls `begin_payment_attempt(booking, student)` with the service role. It locks the booking and refuses a booking that belongs to someone else (403), is not `Pending` (409), has a lapsed or missing hold expiry (409), or has nothing to pay (409). It returns the booking's open attempt, or creates one with the booking's stored `total_amount` and `expires_at`.
3. If the attempt already has an Ozow URL, the function returns it. Otherwise it gets a One API token (`payments` scope) and calls `POST /payments` with `Idempotency-Key` set to the attempt id. It sends the attempt's reference as `merchantReference` and `beneficiaryReference`, its amount, `expireAt` equal to the hold expiry, `returnUrl` `$APP_URL/payments/return?booking=<id>`, and `notifyUrl` `$SUPABASE_URL/functions/v1/ozow-notify`.
4. The function stores Ozow's payment id and `redirectUrl` on the attempt and returns the URL. The app sends the browser there.
5. Ozow returns the student to `/payments/return`. That page reads the booking from the database and shows paid, not confirmed yet, hold expired, or closed. It ignores every query parameter except `booking` and writes nothing.

`ozow-notify` does not exist yet. Issue #27 adds it and is the only path that marks a booking paid.

## Payment attempts

`payment_attempts` holds one row per Ozow payment request: `reference` (`DA` and ten hex digits, inside Ozow's 20 letters and digits), `amount`, `expires_at`, `status` (`open` or `failed`), `ozow_payment_id` and `redirect_url`. A partial unique index allows one `open` attempt per booking, so retries and parallel clicks share it. If Ozow refuses the request, the attempt becomes `failed` and the next click starts a new attempt with a new reference.

Students can read the attempts on their own bookings. Only the service role writes them, and only the service role can execute `begin_payment_attempt`.

## Secrets

The function reads these from its environment. `supabase/functions/.env.example` lists them with empty values.

| Name | Value |
|---|---|
| `OZOW_API_URL` | `https://stagingone.ozow.com/v1` for staging, `https://one.ozow.com/v1` for production |
| `OZOW_CLIENT_ID`, `OZOW_CLIENT_SECRET` | A One API client with the `payments` scope (Ozow Dashboard, One API, Clients) |
| `OZOW_SITE_CODE` | The site code from the Ozow Dashboard, Sites |
| `APP_URL` | Public origin of the web app. Ozow refuses `localhost` return URLs |

Until all five are set the function answers 503 and the app says online payment is not available yet. Set them on the hosted project with `supabase secrets set --env-file supabase/functions/.env`.

## Local testing

`supabase/functions/tests/ozow-mock.ts` stands in for One API. It checks the bearer token, the `PaymentRequest` fields from Ozow's [OpenAPI document](https://hub.ozow.com/api-reference/specs/one-api.yaml), and `Idempotency-Key` replays, and serves a payment page that links back to the return URL. From `doctor_website_demo/`, with the local stack running:

```sh
supabase functions serve --env-file supabase/functions/tests/ozow-mock.env &
eval "$(supabase status -o env | sed 's/^/export /')"
cd supabase/functions
SUPABASE_URL="$API_URL" SUPABASE_ANON_KEY="$ANON_KEY" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" OZOW_MOCK_PORT=55590 \
  deno test --allow-net --allow-env tests/
```

For a manual run in the browser, start the mock with `deno run --allow-net --allow-env tests/ozow-mock.ts` and the app on `http://127.0.0.1:5173`.

`supabase/checks/payment_attempt_race.sh` races twelve parallel attempt starts on one booking and expects one attempt.
