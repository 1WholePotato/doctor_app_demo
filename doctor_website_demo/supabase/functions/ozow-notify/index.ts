import { createClient } from "npm:@supabase/supabase-js@2.102.1";
import { ozowFromEnv } from "../_shared/ozow.ts";
import { notifyHandler } from "./notify.ts";

const env = (name: string) => Deno.env.get(name) ?? "";

Deno.serve(notifyHandler({
  db: createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } }),
  ozow: ozowFromEnv(env),
}));
