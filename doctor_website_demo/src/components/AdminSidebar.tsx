import type { ElementType } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
} from "lucide-react";
import { signOut } from "../lib/auth";

function NavItem({
  to,
  icon: Icon,
  label,
  active,
  onPrefetch,
  onClick,
}: {
  to: string;
  icon: ElementType;
  label: string;
  active: boolean;
  onPrefetch?: () => void;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      className={`nav-item${active ? " active" : ""}`}
      onMouseEnter={onPrefetch}
      onFocus={onPrefetch}
      onClick={onClick}
    >
      <Icon />
      {label}
    </Link>
  );
}

export default function AdminSidebar({
  onCloseMobile,
}: {
  onCloseMobile?: () => void;
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    onCloseMobile?.();
    await signOut();
    navigate("/login");
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <BookOpen size={20} color="var(--gold)" />
        Dr <span>Admin</span>
      </div>

      <nav className="sidebar-nav">
        <p className="nav-section-label">Main</p>
        <NavItem
          to="/dashboard"
          icon={LayoutDashboard}
          label="Dashboard"
          active={pathname === "/dashboard"}
          onPrefetch={() => void import("../pages/AdminLanding")}
          onClick={onCloseMobile}
        />
        <NavItem
          to="/admincourses"
          icon={BookOpen}
          label="Courses"
          active={pathname.startsWith("/admincourses")}
          onPrefetch={() => void import("../pages/AdminCourse")}
          onClick={onCloseMobile}
        />
        <NavItem
          to="/admin/users"
          icon={Users}
          label="Users"
          active={pathname.startsWith("/admin/users")}
          onPrefetch={() => void import("../pages/AdminUsers")}
          onClick={onCloseMobile}
        />

        <p className="nav-section-label">System</p>
        <NavItem
          to="/settings"
          icon={Settings}
          label="Settings"
          active={pathname === "/settings"}
          onPrefetch={() => void import("../pages/AdminSettings")}
          onClick={onCloseMobile}
        />
      </nav>

      <div className="sidebar-footer">
        <button
          className="nav-item"
          style={{ color: "#666664" }}
          onClick={() => void handleSignOut()}
        >
          <LogOut />
          Sign out
        </button>
      </div>
    </aside>
  );
}
