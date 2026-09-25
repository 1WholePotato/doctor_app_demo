import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { homeForRole } from "../lib/auth";

type RequireAuthProps = {
  children: ReactNode;
  role?: "admin" | "student";
};

export default function RequireAuth({ children, role }: RequireAuthProps) {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role === "admin" && !isAdmin) {
    return <Navigate to={homeForRole(user.role_id)} replace />;
  }

  if (role === "student" && isAdmin) {
    return <Navigate to={homeForRole(user.role_id)} replace />;
  }

  return <>{children}</>;
}
