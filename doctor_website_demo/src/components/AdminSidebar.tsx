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
}: {
  to: string;
  icon: ElementType;
  label: string;
  active: boolean;
}) {
  return (
    <Link to={to} className={`nav-item${active ? " active" : ""}`}>
      <Icon />
      {label}
    </Link>
  );
}

export default function AdminSidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
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
        />
        <NavItem
          to="/admincourses"
          icon={BookOpen}
          label="Courses"
          active={pathname.startsWith("/admincourses")}
        />
        <NavItem
          to="/admin/users"
          icon={Users}
          label="Students"
          active={pathname.startsWith("/admin/users")}
        />
        <p className="nav-section-label">Account</p>
        <NavItem
          to="/settings"
          icon={Settings}
          label="Settings"
          active={pathname.startsWith("/settings")}
        />
      </nav>

      <div className="sidebar-footer">
        <button className="nav-item" style={{ color: "#665F5C" }} onClick={() => void handleSignOut()}>
          <LogOut />
          Sign out
        </button>
      </div>
    </aside>
  );
}
