import { createClient } from "npm:@supabase/supabase-js@2.102.1";

export const env = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Set ${name} from supabase status -o env`);
  return value;
};

export const supabaseUrl = env("SUPABASE_URL");
export const anonKey = env("SUPABASE_ANON_KEY");
export const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
export const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

export const COURSE = "b0100000-0000-4000-8000-000000000023";
export const LOCATION = "b0100000-0000-4000-8000-000000000022";
export const PRINTED = "b0100000-0000-4000-8000-000000000061";

export type Student = Awaited<ReturnType<typeof signIn>>;
export type HeldBooking = { id: string; total_amount: string; expires_at: string };
export type Checkout = { status: number; body: { url?: string; reference?: string; amount?: number; expiresAt?: string; error?: string } };

export async function signIn(email: string) {
  const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password: "LocalDemo-B01!" });
  if (error) throw error;
  return { client, token: data.session.access_token };
}

export async function reserve(who: Student, classId: string): Promise<HeldBooking> {
  const { data, error } = await who.client.rpc("reserve_seat", { p_course_session_id: classId, p_material_type_id: PRINTED });
  if (error) throw error;
  return data as HeldBooking;
}

export async function pay(token: string, body: unknown): Promise<Checkout> {
  const response = await fetch(`${supabaseUrl}/functions/v1/ozow-checkout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

export async function attempts(bookingId: string) {
  const { data, error } = await admin.from("payment_attempts").select("*").eq("booking_id", bookingId).order("created_at");
  if (error) throw error;
  return data;
}
