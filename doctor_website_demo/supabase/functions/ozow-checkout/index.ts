import { createClient } from "npm:@supabase/supabase-js@2.102.1";
import { checkoutHandler } from "./checkout.ts";
import { ozowClient } from "./ozow.ts";

const env = (name: string) => Deno.env.get(name) ?? "";
const supabaseUrl = env("SUPABASE_URL");
const ozowConfig = {
  apiUrl: env("OZOW_API_URL"),
  clientId: env("OZOW_CLIENT_ID"),
  clientSecret: env("OZOW_CLIENT_SECRET"),
  siteCode: env("OZOW_SITE_CODE"),
};
const appUrl = env("APP_URL").replace(/\/$/, "");

Deno.serve(checkoutHandler({
  db: createClient(supabaseUrl, env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } }),
  ozow: appUrl && Object.values(ozowConfig).every(Boolean) ? ozowClient(ozowConfig) : null,
  appUrl,
  notifyUrl: `${supabaseUrl}/functions/v1/ozow-notify`,
}));
