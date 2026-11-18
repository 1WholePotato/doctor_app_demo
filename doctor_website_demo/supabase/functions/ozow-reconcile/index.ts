import { createClient } from "npm:@supabase/supabase-js@2.102.1";
import { ozowFromEnv } from "../_shared/ozow.ts";
import { reconcileHandler } from "./reconcile.ts";

const env = (name: string) => Deno.env.get(name) ?? "";

Deno.serve(reconcileHandler({
  db: createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } }),
  ozow: ozowFromEnv(env),
  serviceRoleKey: env("SUPABASE_SERVICE_ROLE_KEY"),
}));
