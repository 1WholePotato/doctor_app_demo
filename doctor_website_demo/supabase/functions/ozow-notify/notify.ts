import type { SupabaseClient } from "npm:@supabase/supabase-js@2.102.1";
import type { OzowClient } from "../_shared/ozow.ts";
import { settleAttempt } from "../_shared/settle.ts";

export type NotifyDeps = { db: SupabaseClient; ozow: OzowClient | null };

const REFERENCE = /^[A-Z0-9]{1,20}$/;

export function notifyHandler({ db, ozow }: NotifyDeps) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") return Response.json({ error: "Use POST." }, { status: 405 });
    if (!ozow) return Response.json({ error: "Ozow is not configured." }, { status: 503 });

    const reference = new URLSearchParams(await req.text()).get("TransactionReference") ?? "";
    if (!REFERENCE.test(reference)) return Response.json({ error: "Send TransactionReference as a form field." }, { status: 400 });

    const { data, error } = await db
      .from("payment_attempts")
      .select("reference, ozow_payment_id, created_at")
      .eq("reference", reference)
      .maybeSingle();
    if (error) {
      console.error("payment attempt lookup failed", error);
      return Response.json({ error: "Could not read the payment." }, { status: 500 });
    }
    if (!data) return Response.json({ error: "No payment has this reference." }, { status: 404 });
    if (!data.ozow_payment_id) return Response.json({ outcome: "unchanged" });

    try {
      return Response.json({ outcome: await settleAttempt({ db, ozow }, data) });
    } catch (failure) {
      console.error(`settling ${reference} failed`, failure);
      return Response.json({ error: "Could not confirm the payment with Ozow." }, { status: 502 });
    }
  };
}
