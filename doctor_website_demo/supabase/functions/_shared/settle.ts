import type { SupabaseClient } from "npm:@supabase/supabase-js@2.102.1";
import type { OzowClient } from "./ozow.ts";

export type SettleDeps = { db: SupabaseClient; ozow: OzowClient };

export type SettleableAttempt = { reference: string; ozow_payment_id: string; created_at: string };

export type SettleOutcome = "paid" | "late_paid" | "review" | "mismatch" | "failed" | "unchanged";

export async function settleAttempt({ db, ozow }: SettleDeps, attempt: SettleableAttempt): Promise<SettleOutcome> {
  const transactions = await ozow.paymentTransactions(attempt.ozow_payment_id, new Date(attempt.created_at));
  const { data, error } = await db.rpc("settle_payment_attempt", {
    p_ozow_payment_id: attempt.ozow_payment_id,
    p_transactions: transactions,
  });
  if (error) throw error;
  return data as SettleOutcome;
}

export function reply(status: number, body: unknown): Response {
  return Response.json(body, { status });
}
