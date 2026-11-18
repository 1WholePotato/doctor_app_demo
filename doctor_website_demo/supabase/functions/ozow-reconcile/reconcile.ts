import type { SupabaseClient } from "npm:@supabase/supabase-js@2.102.1";
import type { OzowClient } from "../_shared/ozow.ts";
import { reply, settleAttempt, type SettleableAttempt, type SettleOutcome } from "../_shared/settle.ts";

export type ReconcileDeps = { db: SupabaseClient; ozow: OzowClient | null; serviceRoleKey: string };

const LATE_PAYMENT_WINDOW_MS = 86_400_000;

async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function isServiceRole(req: Request, serviceRoleKey: string): Promise<boolean> {
  const bearer = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return serviceRoleKey !== "" && (await digest(bearer)) === (await digest(serviceRoleKey));
}

export function reconcileHandler({ db, ozow, serviceRoleKey }: ReconcileDeps) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") return reply(405, { error: "Use POST." });
    if (!(await isServiceRole(req, serviceRoleKey))) return reply(401, { error: "Only the service role can reconcile payments." });
    if (!ozow) return reply(503, { error: "Ozow is not configured." });

    const lateSince = new Date(Date.now() - LATE_PAYMENT_WINDOW_MS).toISOString();
    const { data, error } = await db
      .from("payment_attempts")
      .select("reference, ozow_payment_id, created_at")
      .not("ozow_payment_id", "is", null)
      .or(`status.eq.open,and(status.eq.failed,expires_at.gt.${lateSince})`)
      .order("created_at");
    if (error) {
      console.error("listing payment attempts failed", error);
      return reply(500, { error: "Could not list payment attempts." });
    }

    const settled: Record<string, SettleOutcome> = {};
    const failed: string[] = [];
    for (const attempt of data as SettleableAttempt[]) {
      try {
        settled[attempt.reference] = await settleAttempt({ db, ozow }, attempt);
      } catch (failure) {
        console.error(`reconciling ${attempt.reference} failed`, failure);
        failed.push(attempt.reference);
      }
    }
    return reply(failed.length ? 502 : 200, { checked: data.length, settled, failed });
  };
}
