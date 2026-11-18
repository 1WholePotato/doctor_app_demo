import type { SupabaseClient } from "npm:@supabase/supabase-js@2.102.1";
import { OzowError, type OzowClient } from "../_shared/ozow.ts";

export type CheckoutDeps = {
  db: SupabaseClient;
  ozow: OzowClient | null;
  appUrl: string;
  notifyUrl: string;
};

type Attempt = {
  id: string;
  booking_id: string;
  reference: string;
  amount: number | string;
  expires_at: string;
  redirect_url: string | null;
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const REFUSAL_STATUS: Record<string, number> = { P0002: 404, "42501": 403, "23514": 409 };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

function checkout(attempt: Attempt, url: string): Response {
  return reply(200, { url, reference: attempt.reference, amount: Number(attempt.amount), expiresAt: attempt.expires_at });
}

async function readBookingId(req: Request): Promise<string | null> {
  const body = await req.json().catch(() => null);
  const bookingId = body?.bookingId;
  return typeof bookingId === "string" && UUID.test(bookingId) ? bookingId : null;
}

export function checkoutHandler({ db, ozow, appUrl, notifyUrl }: CheckoutDeps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
    if (req.method !== "POST") return reply(405, { error: "Use POST." });
    if (!ozow) return reply(503, { error: "Online payment is not available yet." });

    const jwt = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const { data: auth } = await db.auth.getUser(jwt);
    if (!auth.user) return reply(401, { error: "Sign in to pay." });

    const bookingId = await readBookingId(req);
    if (!bookingId) return reply(400, { error: "Send the booking to pay as bookingId." });

    const { data, error } = await db.rpc("begin_payment_attempt", { p_booking_id: bookingId, p_student_id: auth.user.id });
    if (error) {
      const status = REFUSAL_STATUS[error.code];
      if (!status) console.error("begin_payment_attempt failed", error);
      return reply(status ?? 500, { error: status ? error.message : "Could not start the payment." });
    }
    const attempt = data as Attempt;
    if (attempt.redirect_url) return checkout(attempt, attempt.redirect_url);

    try {
      const payment = await ozow.createPayment({
        idempotencyKey: attempt.id,
        reference: attempt.reference,
        amount: Number(attempt.amount),
        expiresAt: new Date(attempt.expires_at).toISOString(),
        returnUrl: `${appUrl}/payments/return?booking=${attempt.booking_id}`,
        notifyUrl,
      });
      const { data: saved, error: saveError } = await db
        .from("payment_attempts")
        .update({ ozow_payment_id: payment.id, redirect_url: payment.redirectUrl })
        .eq("id", attempt.id)
        .select()
        .maybeSingle();
      if (saveError || !saved) throw saveError ?? new Error(`attempt ${attempt.id} vanished before Ozow answered`);
      if (saved.status !== "open") throw new Error(`attempt ${attempt.id} closed before Ozow answered`);
      return checkout(saved as Attempt, payment.redirectUrl);
    } catch (failure) {
      console.error("Ozow payment request failed", failure instanceof OzowError ? failure.message : failure);
      await db.from("payment_attempts").update({ status: "failed" }).eq("id", attempt.id).eq("status", "open").is("redirect_url", null);
      return reply(502, { error: "Ozow could not start the payment. Try again." });
    }
  };
}
