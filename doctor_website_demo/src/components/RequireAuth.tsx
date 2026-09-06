import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { getSessionUser, homeForRole, type AppUser } from "../lib/auth";
import { isAdminRole } from "../lib/roles";

type RequireAuthProps = {
  children: ReactNode;
  role?: "admin" | "student";
};

export default function RequireAuth({ children, role }: RequireAuthProps) {
  const [user, setUser] = useState<AppUser | null | undefined>(undefined);

  useEffect(() => {
    void getSessionUser().then(setUser);
  }, []);

  if (user === undefined) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role === "admin" && !isAdminRole(user.role_id)) {
    return <Navigate to={homeForRole(user.role_id)} replace />;
  }

  if (role === "student" && isAdminRole(user.role_id)) {
    return <Navigate to={homeForRole(user.role_id)} replace />;
  }

  return <>{children}</>;
}
