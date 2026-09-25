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
    void refreshUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null);
        setLoading(false);
      } else {
        void refreshUser();
      }
    });

    return () => {
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
