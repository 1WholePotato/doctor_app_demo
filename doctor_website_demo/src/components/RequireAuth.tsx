import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { homeForRole } from "../lib/auth";

type RequireAuthProps = {
  children: ReactNode;
  role?: "admin" | "student";
};

export default function RequireAuth({ children, role }: RequireAuthProps) {
  const { user, isAdmin, loading, authError, refreshUser } = useAuth();

  if (loading) {
    return <main aria-live="polite" style={{ padding: 32 }}>Checking your account…</main>;
  }

  if (authError) {
    return (
      <main role="alert" style={{ maxWidth: 480, margin: "12vh auto", padding: 24, textAlign: "center" }}>
        <p>{authError}</p>
        <button type="button" onClick={() => void refreshUser()}>Try again</button>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // RAD client routing is for navigation only; database authorization must enforce access.
  if (role === "admin" && !isAdmin) {
    return <Navigate to={homeForRole(user.role_id)} replace />;
  }

  if (role === "student" && isAdmin) {
    return <Navigate to={homeForRole(user.role_id)} replace />;
  }

  return <>{children}</>;
}
