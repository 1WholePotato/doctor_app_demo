import { useEffect, useState, type ReactNode } from "react";
import { getSessionUser, type AppUser } from "../lib/auth";
import { isAdminRole } from "../lib/roles";
import { supabase } from "../supabaseClient";
import { AuthContext } from "./authContextDef";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const refreshUser = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (!session) {
        setUser(null);
        return;
      }

      const current = await getSessionUser();
      if (!current) throw new Error("Your account profile could not be verified.");
      setUser(current);
    } catch (err) {
      console.error("Auth refresh error:", err);
      setAuthError("We couldn't verify your account. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Single source of truth: onAuthStateChange fires INITIAL_SESSION on setup
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        if (mounted) {
          setUser(null);
          setAuthError(null);
          setLoading(false);
        }
      } else {
        if (mounted) {
          setLoading(true);
          setAuthError(null);
        }
        try {
          const current = await getSessionUser();
          if (!current) throw new Error("Your account profile could not be verified.");
          if (mounted) setUser(current);
        } catch (err) {
          console.error("Auth session change error:", err);
          if (mounted) setAuthError("We couldn't verify your account. Check your connection and try again.");
        } finally {
          if (mounted) setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const isAdmin = user ? isAdminRole(user.role_id) : false;

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, authError, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
