import type { SupabaseClient } from "npm:@supabase/supabase-js@2.102.1";
import type { OzowClient } from "../_shared/ozow.ts";
import { reply, settleAttempt, type SettleableAttempt } from "../_shared/settle.ts";

export type NotifyDeps = { db: SupabaseClient; ozow: OzowClient | null };

const REFERENCE = /^[A-Z0-9]{1,20}$/;

export function notifyHandler({ db, ozow }: NotifyDeps) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") return reply(405, { error: "Use POST." });
    if (!ozow) return reply(503, { error: "Ozow is not configured." });

    const reference = new URLSearchParams(await req.text()).get("TransactionReference") ?? "";
    if (!REFERENCE.test(reference)) return reply(400, { error: "Send TransactionReference as a form field." });

    const { data, error } = await db
      .from("payment_attempts")
      .select("reference, ozow_payment_id, created_at")
      .eq("reference", reference)
      .maybeSingle();
    if (error) {
      console.error("payment attempt lookup failed", error);
      return reply(500, { error: "Could not read the payment." });
    }
    if (!data) return reply(404, { error: "No payment has this reference." });
    if (!data.ozow_payment_id) return reply(200, { outcome: "unchanged" });

    try {
      return reply(200, { outcome: await settleAttempt({ db, ozow }, data as SettleableAttempt) });
    } catch (failure) {
      console.error(`settling ${reference} failed`, failure);
      return reply(502, { error: "Could not confirm the payment with Ozow." });
    }
  };
}
