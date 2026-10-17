import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { getSessionUser } from "../lib/auth";
import { isAdminRole } from "../lib/roles";
import { authSignals } from "../supabaseClient";
import { AuthContext } from "./authContextDef";
import { createAuthLifecycle, initialAuthState } from "./authLifecycle";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialAuthState);
  const lifecycle = useRef<ReturnType<typeof createAuthLifecycle> | null>(null);

  useEffect(() => {
    const current = createAuthLifecycle({
      observe: authSignals.observe,
      loadUser: getSessionUser,
      publish: setState,
    });
    lifecycle.current = current;
    return () => {
      current.dispose();
      lifecycle.current = null;
    };
  }, []);

  const refreshUser = useCallback(async () => {
    if (!lifecycle.current) throw new Error("Account verification is not ready.");
    await lifecycle.current.refreshUser();
  }, []);
  const isAdmin = state.user ? isAdminRole(state.user.role_id) : false;

  return (
    <AuthContext.Provider value={{ ...state, isAdmin, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
