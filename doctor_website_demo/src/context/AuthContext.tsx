import { useEffect, useState, type ReactNode } from "react";
import { getSessionUser, type AppUser } from "../lib/auth";
import { isAdminRole } from "../lib/roles";
import { supabase } from "../supabaseClient";
import { AuthContext } from "./authContextDef";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const current = await getSessionUser();
      setUser(current);
    } catch (err) {
      console.error("Auth refresh error:", err);
      setUser(null);
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
          setLoading(false);
        }
      } else {
        try {
          const current = await getSessionUser();
          if (mounted) setUser(current);
        } catch (err) {
          console.error("Auth session change error:", err);
          if (mounted) setUser(null);
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
    <AuthContext.Provider value={{ user, isAdmin, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
