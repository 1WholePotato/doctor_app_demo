import type { SupabaseClient } from "@supabase/supabase-js";

export type AuthSignal =
  | { kind: "initializing" }
  | { kind: "signed-out" }
  | { kind: "signed-in"; userId: string; passwordRecovery: boolean };

export type ObserveAuth = (listener: (signal: AuthSignal) => void) => () => void;

export function createAuthSignals(auth: SupabaseClient["auth"]) {
  let signal: AuthSignal = { kind: "initializing" };
  const listeners = new Set<(signal: AuthSignal) => void>();
  const { data: { subscription } } = auth.onAuthStateChange((event, session) => {
    const previous = signal;
    signal = session ? {
      kind: "signed-in",
      userId: session.user.id,
      // Keep successful password-update feedback visible until this identity leaves.
      passwordRecovery: event === "PASSWORD_RECOVERY"
        || (previous.kind === "signed-in" && previous.userId === session.user.id && previous.passwordRecovery),
    } : { kind: "signed-out" };
    for (const listener of listeners) listener(signal);
  });

  const observe: ObserveAuth = (listener) => {
    listeners.add(listener);
    listener(signal);
    return () => { listeners.delete(listener); };
  };

  return {
    observe,
    dispose() {
      subscription.unsubscribe();
      listeners.clear();
    },
  };
}
