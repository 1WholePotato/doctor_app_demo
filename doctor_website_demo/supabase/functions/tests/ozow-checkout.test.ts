import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1.0.14";
import { createClient } from "npm:@supabase/supabase-js@2.102.1";
import { startOzowMock } from "./ozow-mock.ts";

const env = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Set ${name} from supabase status -o env`);
  return value;
};
const supabaseUrl = env("SUPABASE_URL");
const anonKey = env("SUPABASE_ANON_KEY");
const admin = createClient(supabaseUrl, env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const APP_URL = "http://127.0.0.1:5173";
const COURSE = "b0100000-0000-4000-8000-000000000023";
const LOCATION = "b0100000-0000-4000-8000-000000000022";
const PRINTED = "b0100000-0000-4000-8000-000000000061";
const CONFIRMED_BOOKING = "b0100000-0000-4000-8000-000000000034";
const CLASSES = ["b1100000-0000-4000-8000-000000000001", "b1100000-0000-4000-8000-000000000002"];

type Checkout = { status: number; body: { url?: string; reference?: string; amount?: number; expiresAt?: string; error?: string } };

async function signIn(email: string) {
  const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password: "LocalDemo-B01!" });
  if (error) throw error;
  return { client, token: data.session.access_token };
}

async function pay(token: string, body: unknown): Promise<Checkout> {
  const response = await fetch(`${supabaseUrl}/functions/v1/ozow-checkout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function attempts(bookingId: string) {
  const { data, error } = await admin.from("payment_attempts").select("*").eq("booking_id", bookingId).order("created_at");
  if (error) throw error;
  return data;
}

async function cleanup() {
  const { data: bookings } = await admin.from("bookings").select("id").in("course_session_id", CLASSES);
  const ids = (bookings ?? []).map((booking) => booking.id);
  await admin.from("payment_attempts").delete().in("booking_id", ids);
  await admin.from("bookings").delete().in("id", ids);
  await admin.from("course_sessions").delete().in("id", CLASSES);
}

Deno.test("ozow-checkout starts one Ozow payment per held booking from the stored total", async (t) => {
  const mock = startOzowMock({ port: Number(env("OZOW_MOCK_PORT")), hostname: "0.0.0.0" });
  await cleanup();
  const { error: classError } = await admin.from("course_sessions").insert(CLASSES.map((id, n) => ({
    id, course_id: COURSE, location_id: LOCATION, start_date: "2027-03-0" + (n + 1), end_date: "2027-03-0" + (n + 1),
    start_time: "09:00", end_time: "12:00", max_students: 10,
  })));
  if (classError) throw classError;

  const student = await signIn("student@example.test");
  const second = await signIn("second-student@example.test");
  const reserve = async (who: typeof student, classId: string) => {
    const { data, error } = await who.client.rpc("reserve_seat", { p_course_session_id: classId, p_material_type_id: PRINTED });
    if (error) throw error;
    return data as { id: string; total_amount: string; expires_at: string };
  };
  const held = await reserve(student, CLASSES[0]);

  try {
    await t.step("a held booking gets an Ozow URL for its stored total and a fresh reference", async () => {
      const checkout = await pay(student.token, { bookingId: held.id });
      const [attempt] = await attempts(held.id);

      assertEquals(checkout.status, 200);
      assertEquals(checkout.body.amount, 250);
      assertEquals(Number(held.total_amount), 250);
      assertMatch(checkout.body.reference!, /^DA[0-9A-F]{10}$/);
      assertEquals(checkout.body.url, `http://127.0.0.1:${mock.port}/${attempt.ozow_payment_id}/secure`);
      assertEquals(mock.createRequests.length, 1);
      const [sent] = mock.createRequests;
      assertEquals(sent.idempotencyKey, attempt.id);
      assertEquals(sent.body.amount, { currency: "ZAR", value: 250 });
      assertEquals([sent.body.merchantReference, sent.body.beneficiaryReference], [attempt.reference, attempt.reference]);
      assertEquals(sent.body.expireAt, new Date(held.expires_at).toISOString());
      assertEquals(sent.body.returnUrl, `${APP_URL}/payments/return?booking=${held.id}`);
      assertMatch(String(sent.body.notifyUrl), /\/functions\/v1\/ozow-notify$/);
    });

    await t.step("a retry returns the same attempt without asking Ozow again, whatever the browser sends", async () => {
      const first = (await attempts(held.id))[0];
      const retry = await pay(student.token, { bookingId: held.id, amount: 1, reference: "FORGED", total_amount: 1 });

      assertEquals(retry.status, 200);
      assertEquals([retry.body.url, retry.body.reference, retry.body.amount], [first.redirect_url, first.reference, 250]);
      assertEquals((await attempts(held.id)).length, 1);
      assertEquals(mock.createRequests.length, 1);
    });

    await t.step("parallel clicks on a fresh hold share one attempt and one Ozow payment", async () => {
      const booking = await reserve(second, CLASSES[0]);
      const results = await Promise.all(Array.from({ length: 6 }, () => pay(second.token, { bookingId: booking.id })));
      const rows = await attempts(booking.id);

      assertEquals(results.map((result) => result.status), [200, 200, 200, 200, 200, 200]);
      assertEquals(new Set(results.map((result) => result.body.url)).size, 1);
      assertEquals(rows.length, 1);
      assertEquals([...mock.payments.values()].filter((payment) => payment.idempotencyKey === rows[0].id).length, 1);
    });

    await t.step("another student's booking is refused", async () => {
      const checkout = await pay(second.token, { bookingId: held.id });
      assertEquals(checkout.status, 403);
      assertMatch(checkout.body.error!, /belongs to another student/);
    });

    await t.step("a booking that is not awaiting payment is refused", async () => {
      const checkout = await pay(student.token, { bookingId: CONFIRMED_BOOKING });
      assertEquals(checkout.status, 409);
      assertMatch(checkout.body.error!, /not awaiting payment/);
    });

    await t.step("a lapsed hold is refused even with an open attempt", async () => {
      await admin.from("bookings").update({ expires_at: new Date(Date.now() - 60_000).toISOString() }).eq("id", held.id);
      const checkout = await pay(student.token, { bookingId: held.id });
      assertEquals(checkout.status, 409);
      assertMatch(checkout.body.error!, /has expired/);
    });

    await t.step("unknown, malformed and unsigned requests are refused", async () => {
      assertEquals((await pay(student.token, { bookingId: crypto.randomUUID() })).status, 404);
      assertEquals((await pay(student.token, { bookingId: "not-a-booking" })).status, 400);
      assertEquals((await pay(anonKey, { bookingId: held.id })).status, 401);
    });

    await t.step("when Ozow refuses, the attempt fails and the next click starts a new one", async () => {
      const booking = await reserve(student, CLASSES[1]);
      mock.refuseNextPayment();
      const refused = await pay(student.token, { bookingId: booking.id });
      assertEquals(refused.status, 502);
      assertEquals((await attempts(booking.id)).map((row) => [row.status, row.redirect_url]), [["failed", null]]);

      const retried = await pay(student.token, { bookingId: booking.id });
      const rows = await attempts(booking.id);
      assertEquals(retried.status, 200);
      assertEquals(rows.map((row) => row.status), ["failed", "open"]);
      assert(rows[0].reference !== rows[1].reference, "the new attempt has its own reference");
      assertEquals(retried.body.reference, rows[1].reference);
    });
  } finally {
    await cleanup();
    await mock.close();
  }
});
