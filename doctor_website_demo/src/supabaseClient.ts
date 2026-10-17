import { createClient } from "@supabase/supabase-js";
import { createAuthSignals } from "./lib/authSignals";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const authSignals = createAuthSignals(supabase.auth);

if (import.meta.hot) {
  import.meta.hot.dispose(() => authSignals.dispose());
}
