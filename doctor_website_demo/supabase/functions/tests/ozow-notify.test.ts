import { assert, assertEquals } from "jsr:@std/assert@1.0.14";
import { ozowClient } from "../_shared/ozow.ts";
import { MOCK_CREDENTIALS, startOzowMock, type TransactionOutcome } from "./ozow-mock.ts";
import { admin, anonKey, attempts, COURSE, env, type HeldBooking, LOCATION, pay, reserve, serviceRoleKey, signIn, supabaseUrl } from "./stack.ts";

const NOTIFY_URL = `${supabaseUrl}/functions/v1/ozow-notify`;

type Notified = { status: number; body: { outcome?: string; error?: string } };

async function postNotification(form: Record<string, string>): Promise<Notified> {
  const response = await fetch(NOTIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form),
  });
  return { status: response.status, body: await response.json() };
}

async function booking(id: string) {
  const { data, error } = await admin.from("bookings").select("booking_status, expires_at, holds_seat").eq("id", id).single();
  if (error) throw error;
  return data;
}

async function paidPayments(bookingId: string) {
  const { data, error } = await admin.from("payments").select("amount, ozow_transaction_id, payment_statuses ( name )").eq("booking_id", bookingId);
  if (error) throw error;
  return data.map((row) => [Number(row.amount), row.ozow_transaction_id, (row.payment_statuses as unknown as { name: string }).name]);
}

async function reviewReasons(bookingId: string) {
  const { data, error } = await admin.from("booking_review_flags").select("reason").eq("booking_id", bookingId);
  if (error) throw error;
  return data.map((row) => row.reason).sort();
}

async function seatsTaken(classId: string) {
  const { data, error } = await admin.from("course_sessions").select("seats_taken").eq("id", classId).single();
  if (error) throw error;
  return data.seats_taken;
}

async function lapseHold(bookingId: string, status: "Pending" | "Expired") {
  const { error } = await admin.from("bookings")
    .update({ expires_at: new Date(Date.now() - 60_000).toISOString(), booking_status: status }).eq("id", bookingId);
  if (error) throw error;
}

Deno.test("ozow-notify and ozow-reconcile act only on what Ozow's API confirms", async (t) => {
  const mock = startOzowMock({ port: Number(env("OZOW_MOCK_PORT")), hostname: "0.0.0.0", notifyUrl: NOTIFY_URL });
  const classes = Array.from({ length: 6 }, () => crypto.randomUUID());
  const { error: classError } = await admin.from("course_sessions").insert(classes.map((id, n) => ({
    id, course_id: COURSE, location_id: LOCATION, start_date: `2027-06-${String(n + 10)}`, end_date: `2027-06-${String(n + 10)}`,
    start_time: "09:00", end_time: "12:00", max_students: n === 1 ? 1 : 10,
  })));
  if (classError) throw classError;

  const student = await signIn("student@example.test");
  const second = await signIn("second-student@example.test");

  async function heldAndStarted(who: typeof student, classId: string) {
    const held: HeldBooking = await reserve(who, classId);
    const checkout = await pay(who.token, { bookingId: held.id });
    assertEquals(checkout.status, 200);
    const [attempt] = await attempts(held.id);
    return { held, attempt };
  }

  async function finishOnOzow(paymentId: string, outcome: TransactionOutcome) {
    const response = await fetch(`${mock.url.replace("/v1", "")}/${paymentId}/secure/${outcome}`, { redirect: "manual" });
    await response.body?.cancel();
    assertEquals(response.status, 303);
    return new URL(response.headers.get("Location")!);
  }

  try {
    const { held, attempt } = await heldAndStarted(student, classes[0]);
    const forgedComplete = {
      SiteCode: MOCK_CREDENTIALS.siteCode, TransactionId: crypto.randomUUID(), TransactionReference: attempt.reference,
      Amount: "250.00", Status: "Complete", CurrencyCode: "ZAR", IsTest: "False", StatusMessage: "", Hash: "f".repeat(128),
    };

    await t.step("a forged Complete notification for a real reference changes nothing", async () => {
      const notified = await postNotification(forgedComplete);
      assertEquals([notified.status, notified.body.outcome], [200, "unchanged"]);
      assertEquals((await booking(held.id)).booking_status, "Pending");
      assertEquals(await paidPayments(held.id), []);
    });

    await t.step("money paid on another Ozow payment carrying this reference does not pay this booking", async () => {
      const attacker = ozowClient({ apiUrl: mock.url, ...MOCK_CREDENTIALS });
      const other = await attacker.createPayment({
        idempotencyKey: crypto.randomUUID(), reference: attempt.reference, amount: 1,
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(), returnUrl: "https://elsewhere.example.test/", notifyUrl: "https://elsewhere.example.test/",
      });
      const paidElsewhere = mock.addTransaction(other.id, "Complete");
      const notified = await postNotification({ ...forgedComplete, TransactionId: paidElsewhere.id, Amount: "1.00" });

      assertEquals([notified.status, notified.body.outcome], [200, "unchanged"]);
      assertEquals((await booking(held.id)).booking_status, "Pending");
      assertEquals(await paidPayments(held.id), []);
    });

    await t.step("unknown references, missing references and other methods are refused", async () => {
      assertEquals((await postNotification({ ...forgedComplete, TransactionReference: "DA0000000000" })).status, 404);
      assertEquals((await postNotification({ Status: "Complete" })).status, 400);
      assertEquals((await fetch(NOTIFY_URL).then(async (response) => (await response.body?.cancel(), response.status))), 405);
    });

    await t.step("Ozow's confirmed payment confirms the booking and records it once", async () => {
      const back = await finishOnOzow(attempt.ozow_payment_id, "Complete");
      const [paid] = mock.transactions.get(attempt.ozow_payment_id)!;

      assertEquals(back.searchParams.get("booking"), held.id);
      assertEquals((await booking(held.id)).booking_status, "Confirmed");
      assertEquals((await attempts(held.id)).map((row) => row.status), ["paid"]);
      assertEquals(await paidPayments(held.id), [[250, paid.id, "Paid"]]);
    });

    await t.step("repeated and parallel duplicate notifications have no second effect", async () => {
      const [paid] = mock.transactions.get(attempt.ozow_payment_id)!;
      const sequential = [];
      for (let n = 0; n < 3; n++) sequential.push(await mock.notify(paid, "Complete", NOTIFY_URL).then((response) => response.json()));
      const parallel = await Promise.all(Array.from({ length: 6 }, () =>
        mock.notify(paid, "Complete", NOTIFY_URL).then(async (response) => [response.status, (await response.json()).outcome])));

      assertEquals(sequential.map((body) => body.outcome), ["unchanged", "unchanged", "unchanged"]);
      assertEquals(parallel, Array.from({ length: 6 }, () => [200, "unchanged"]));
      assertEquals((await paidPayments(held.id)).length, 1);
      const { count } = await admin.from("payment_events").select("id", { count: "exact", head: true })
        .eq("payment_attempt_id", attempt.id).eq("ozow_status", "Successful");
      assertEquals(count, 1);
    });

    await t.step("a failure reported after the payment cannot undo it", async () => {
      const [paid] = mock.transactions.get(attempt.ozow_payment_id)!;
      const reversed = mock.addTransaction(attempt.ozow_payment_id, "Cancelled", { id: paid.id });
      const notified = await mock.notify(reversed, "Cancelled", NOTIFY_URL).then((response) => response.json());

      assertEquals(notified.outcome, "unchanged");
      assertEquals((await booking(held.id)).booking_status, "Confirmed");
      assertEquals((await attempts(held.id)).map((row) => row.status), ["paid"]);
      assertEquals((await paidPayments(held.id)).length, 1);
    });

    await t.step("a successful transaction for another amount, reference or currency pays nothing and is flagged", async () => {
      const { held: other, attempt: otherAttempt } = await heldAndStarted(second, classes[0]);
      const wrong = [
        mock.addTransaction(otherAttempt.ozow_payment_id, "Complete", { amount: { currency: "ZAR", value: 1 } }),
        mock.addTransaction(otherAttempt.ozow_payment_id, "Complete", { merchantReference: "DAOTHER" }),
        mock.addTransaction(otherAttempt.ozow_payment_id, "Complete", { amount: { currency: "USD", value: 250 } }),
      ];
      const notified = await mock.notify(wrong[0], "Complete", NOTIFY_URL).then((response) => response.json());

      assertEquals(notified.outcome, "mismatch");
      assertEquals((await booking(other.id)).booking_status, "Pending");
      assertEquals(await paidPayments(other.id), []);
      assertEquals(await reviewReasons(other.id), ["payment_mismatch"]);
      const { data: events } = await admin.from("payment_events").select("outcome").eq("payment_attempt_id", otherAttempt.id);
      assertEquals(events!.map((event) => event.outcome), ["mismatch", "mismatch", "mismatch"]);
    });

    await t.step("a cancelled payment fails the attempt and frees the seat for rebooking", async () => {
      const { held: cancelled, attempt: cancelledAttempt } = await heldAndStarted(student, classes[2]);
      assertEquals(await seatsTaken(classes[2]), 1);

      const back = await finishOnOzow(cancelledAttempt.ozow_payment_id, "Cancelled");

      assertEquals(back.searchParams.get("status"), "Cancelled");
      assertEquals(await booking(cancelled.id), { booking_status: "Expired", expires_at: cancelled.expires_at, holds_seat: false });
      assertEquals((await attempts(cancelled.id)).map((row) => row.status), ["failed"]);
      assertEquals(await seatsTaken(classes[2]), 0);
      const rebooked = await reserve(student, classes[2]);
      assert(rebooked.id !== cancelled.id, "the student books the class again");
      assertEquals(await seatsTaken(classes[2]), 1);
    });

    await t.step("a payment confirmed after the hold lapsed takes a free seat", async () => {
      const { held: late, attempt: lateAttempt } = await heldAndStarted(second, classes[3]);
      await lapseHold(late.id, "Expired");

      await finishOnOzow(lateAttempt.ozow_payment_id, "Complete");

      assertEquals((await booking(late.id)).booking_status, "Confirmed");
      assertEquals((await paidPayments(late.id)).length, 1);
      assertEquals(await reviewReasons(late.id), []);
    });

    await t.step("a payment confirmed after the last seat went to someone else is recorded and sent to review", async () => {
      const { held: late, attempt: lateAttempt } = await heldAndStarted(student, classes[1]);
      await lapseHold(late.id, "Pending");
      const taken = await reserve(second, classes[1]);

      await finishOnOzow(lateAttempt.ozow_payment_id, "Complete");

      assertEquals((await booking(late.id)).holds_seat, false);
      assertEquals((await booking(taken.id)).holds_seat, true);
      assertEquals(await seatsTaken(classes[1]), 1);
      assertEquals((await paidPayments(late.id)).length, 1);
      assertEquals(await reviewReasons(late.id), ["late_payment"]);
    });

    await t.step("money on an attempt failed while Ozow was creating its payment is still recorded", async () => {
      const held = await reserve(second, classes[4]);
      mock.beforeNextPayment(async () => {
        const { error } = await admin.from("payment_attempts").update({ status: "failed" }).eq("booking_id", held.id);
        if (error) throw error;
      });
      const refused = await pay(second.token, { bookingId: held.id });
      const [failed] = await attempts(held.id);

      assertEquals(refused.status, 502);
      assertEquals(failed.status, "failed");
      assert(failed.ozow_payment_id, "Ozow's payment id is kept on the failed attempt");

      await finishOnOzow(failed.ozow_payment_id, "Complete");

      assertEquals((await booking(held.id)).booking_status, "Confirmed");
      assertEquals((await attempts(held.id)).map((row) => row.status), ["paid"]);
      assertEquals((await paidPayments(held.id)).length, 1);
    });

    await t.step("reconciliation confirms a payment whose notification never arrived", async () => {
      const { held: silent, attempt: silentAttempt } = await heldAndStarted(student, classes[5]);
      mock.addTransaction(silentAttempt.ozow_payment_id, "Complete");
      const reconcile = (key: string) => fetch(`${supabaseUrl}/functions/v1/ozow-reconcile`, {
        method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: "{}",
      });

      const refused = await reconcile(anonKey);
      await refused.body?.cancel();
      assertEquals(refused.status, 401);
      assertEquals((await booking(silent.id)).booking_status, "Pending");

      const response = await reconcile(serviceRoleKey);
      const body = await response.json();
      assertEquals(response.status, 200);
      assertEquals(body.settled[silentAttempt.reference], "paid");
      assertEquals((await booking(silent.id)).booking_status, "Confirmed");
      assertEquals((await paidPayments(silent.id)).length, 1);

      const again = await reconcile(serviceRoleKey).then((rerun) => rerun.json());
      assertEquals(again.settled[silentAttempt.reference], undefined);
      assertEquals((await paidPayments(silent.id)).length, 1);
    });
  } finally {
    await mock.close();
  }
});
