import type { AppUser } from "../lib/auth";
import type { AuthSignal, ObserveAuth } from "../lib/authSignals";

export type AuthState = {
  user: AppUser | null;
  loading: boolean;
  authError: string | null;
  passwordRecovery: boolean;
};

export const initialAuthState: AuthState = {
  user: null,
  loading: true,
  authError: null,
  passwordRecovery: false,
};

function sameProfile(a: AppUser, b: AppUser): boolean {
  return a.id === b.id && a.email === b.email && a.role_id === b.role_id
    && a.first_name === b.first_name && a.last_name === b.last_name
    && a.birth_date === b.birth_date && a.id_num === b.id_num
    && a.passport_num === b.passport_num && a.cell_num === b.cell_num
    && a.sanc_num === b.sanc_num && a.active === b.active;
}

export function createAuthLifecycle({ observe, loadUser, publish }: {
  observe: ObserveAuth;
  loadUser: () => Promise<AppUser | null>;
  publish: (state: AuthState) => void;
}) {
  let state = initialAuthState;
  let signal: AuthSignal = { kind: "initializing" };
  let generation = 0;
  let alive = true;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function invalidate() {
    generation += 1;
    clearTimeout(timer);
  }

  function commit(next: AuthState) {
    state = next;
    publish(state);
  }

  async function refreshUser(): Promise<void> {
    if (!alive) throw new Error("Account verification is no longer active.");
    invalidate();
    if (signal.kind !== "signed-in") return;
    const ticket = generation;
    const userId = signal.userId;
    const isCurrent = () => alive && generation === ticket;
    commit({ ...state, loading: !state.user, authError: null });
    try {
      const current = await loadUser();
      if (!isCurrent()) throw new Error("Your session changed. Please try again.");
      if (!current || !current.active || current.id !== userId) {
        commit({ ...state, user: null });
        throw new Error("Your account profile could not be verified.");
      }
      const user = state.user && sameProfile(state.user, current) ? state.user : current;
      commit({ ...state, user, loading: false, authError: null });
    } catch (error) {
      if (isCurrent()) {
        commit({
          ...state,
          loading: false,
          authError: "We couldn't verify your account. Check your connection and try again.",
        });
      }
      throw error;
    }
  }

  const unsubscribe = observe((next) => {
    invalidate();
    signal = next;
    if (next.kind === "initializing") return;
    if (next.kind === "signed-out") {
      commit({ user: null, loading: false, authError: null, passwordRecovery: false });
      return;
    }
    const user = state.user?.id === next.userId ? state.user : null;
    commit({ user, loading: !user, authError: null, passwordRecovery: next.passwordRecovery });
    // Supabase awaits subscribers while holding its auth lock. Hydration must leave that stack.
    timer = setTimeout(() => { void refreshUser().catch(() => {}); }, 0);
  });

  return {
    refreshUser,
    dispose() {
      alive = false;
      invalidate();
      unsubscribe();
    },
  };
}
