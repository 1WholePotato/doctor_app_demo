import type { SupabaseClient } from "npm:@supabase/supabase-js@2.102.1";
import type { OzowClient } from "../_shared/ozow.ts";
import { settleAttempt, type SettleOutcome } from "../_shared/settle.ts";

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
    if (req.method !== "POST") return Response.json({ error: "Use POST." }, { status: 405 });
    if (!(await isServiceRole(req, serviceRoleKey))) return Response.json({ error: "Only the service role can reconcile payments." }, { status: 401 });
    if (!ozow) return Response.json({ error: "Ozow is not configured." }, { status: 503 });

    const now = Date.now();
    const { data: closed, error: closeError } = await db
      .from("payment_attempts")
      .update({ status: "failed" })
      .eq("status", "open")
      .is("ozow_payment_id", null)
      .lte("expires_at", new Date(now).toISOString())
      .select("reference");
    if (closeError) {
      console.error("closing abandoned payment attempts failed", closeError);
      return Response.json({ error: "Could not close abandoned payment attempts." }, { status: 500 });
    }

    const lateSince = new Date(now - LATE_PAYMENT_WINDOW_MS).toISOString();
    const { data, error } = await db
      .from("payment_attempts")
      .select("reference, ozow_payment_id, created_at")
      .not("ozow_payment_id", "is", null)
      .or(`status.in.(open,investigating),and(status.eq.failed,expires_at.gt.${lateSince})`)
      .order("created_at");
    if (error) {
      console.error("listing payment attempts failed", error);
      return Response.json({ error: "Could not list payment attempts." }, { status: 500 });
    }

    const settled: Record<string, SettleOutcome> = {};
    const failed: string[] = [];
    for (const attempt of data) {
      try {
        settled[attempt.reference] = await settleAttempt({ db, ozow }, attempt);
      } catch (failure) {
        console.error(`reconciling ${attempt.reference} failed`, failure);
        failed.push(attempt.reference);
      }
    }
    return Response.json({ checked: data.length, settled, failed, closed: closed.map((attempt) => attempt.reference) }, {
      status: failed.length ? 502 : 200,
    });
  };
}
