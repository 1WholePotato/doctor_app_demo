import { type ElementType } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Settings,
} from "lucide-react";
import { displayName, initials, signOut } from "../lib/auth";
import { useAuth } from "../context/useAuth";

type Prefix = "sl" | "sp";

function NavItem({
  prefix,
  to,
  icon: Icon,
  label,
  active,
  onPrefetch,
  onClick,
}: {
  prefix: Prefix;
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
      className={`${prefix}-nav-item${active ? " active" : ""}`}
      onMouseEnter={onPrefetch}
      onFocus={onPrefetch}
      onClick={onClick}
    >
      <Icon />
      {label}
    </Link>
  );
}

export default function StudentSidebar({
  prefix = "sl",
  onCloseMobile,
}: {
  prefix?: Prefix;
  onCloseMobile?: () => void;
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleSignOut = async () => {
    onCloseMobile?.();
    await signOut();
    navigate("/login");
  };

  const name = user ? displayName(user) : "Student";
  const mark = user ? initials(user) : "ST";

  return (
    <aside className={`${prefix}-sidebar`}>
      <div className={`${prefix}-logo`}>
        <div className={`${prefix}-logo-mark`}>
          <BookOpen />
        </div>
        <div className={`${prefix}-logo-text`}>
          MedLearn
          <span>Student Portal</span>
        </div>
      </div>

      <nav className={`${prefix}-nav`}>
        <p className={`${prefix}-nav-label`}>Menu</p>
        <NavItem
          prefix={prefix}
          to="/studentlanding"
          icon={LayoutDashboard}
          label="Dashboard"
          active={pathname === "/studentlanding"}
          onPrefetch={() => void import("../pages/StudentLanding")}
          onClick={onCloseMobile}
        />
        <NavItem
          prefix={prefix}
          to="/courses"
          icon={BookOpen}
          label="My Courses"
          active={pathname.startsWith("/courses")}
          onPrefetch={() => void import("../pages/StudentCourses")}
          onClick={onCloseMobile}
        />
        <NavItem
          prefix={prefix}
          to="/grades"
          icon={GraduationCap}
          label="Grades"
          active={pathname.startsWith("/grades")}
          onPrefetch={() => void import("../pages/StudentGrades")}
          onClick={onCloseMobile}
        />
        <NavItem
          prefix={prefix}
          to="/notifications"
          icon={Bell}
          label="Notifications"
          active={pathname.startsWith("/notifications")}
          onPrefetch={() => void import("../pages/StudentNotifications")}
          onClick={onCloseMobile}
        />
        <p className={`${prefix}-nav-label`}>Account</p>
        <NavItem
          prefix={prefix}
          to="/profile"
          icon={Settings}
          label="Profile"
          active={pathname.startsWith("/profile")}
          onPrefetch={() => void import("../pages/StudentProfile")}
          onClick={onCloseMobile}
        />
      </nav>

      <div className={`${prefix}-footer`}>
        <div className={`${prefix}-avatar-row`}>
          <div className={`${prefix}-avatar`}>{mark}</div>
          <div>
            <p className={`${prefix}-avatar-name`}>{name}</p>
            <p className={`${prefix}-avatar-role`}>{user?.email ?? "Signed in"}</p>
          </div>
        </div>
        <button
          className={`${prefix}-nav-item`}
          style={{ color: "#4A6080" }}
          onClick={() => void handleSignOut()}
        >
          <LogOut />
          Sign out
        </button>
      </div>
    </aside>
  );
}
