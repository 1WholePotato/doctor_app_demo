import { createClient } from "npm:@supabase/supabase-js@2.102.1";
import { checkoutHandler } from "./checkout.ts";
import { ozowFromEnv } from "../_shared/ozow.ts";

const env = (name: string) => Deno.env.get(name) ?? "";
const supabaseUrl = env("SUPABASE_URL");
const appUrl = env("APP_URL").replace(/\/$/, "");
const ozow = ozowFromEnv(env);

Deno.serve(checkoutHandler({
  db: createClient(supabaseUrl, env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } }),
  ozow: appUrl && ozow ? ozow : null,
  appUrl,
  notifyUrl: `${supabaseUrl}/functions/v1/ozow-notify`,
}));
