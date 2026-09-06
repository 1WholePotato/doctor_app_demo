import { useEffect, useState, type ElementType } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Settings,
} from "lucide-react";
import { displayName, getSessionUser, initials, signOut, type AppUser } from "../lib/auth";

type Prefix = "sl" | "sp";

function NavItem({
  prefix,
  to,
  icon: Icon,
  label,
  active,
}: {
  prefix: Prefix;
  to: string;
  icon: ElementType;
  label: string;
  active: boolean;
}) {
  return (
    <Link to={to} className={`${prefix}-nav-item${active ? " active" : ""}`}>
      <Icon />
      {label}
    </Link>
  );
}

export default function StudentSidebar({ prefix = "sl" }: { prefix?: Prefix }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<AppUser | null>(null);

  useEffect(() => {
    void getSessionUser().then(setUser);
  }, []);

  const handleSignOut = async () => {
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
        />
        <NavItem
          prefix={prefix}
          to="/courses"
          icon={BookOpen}
          label="My Courses"
          active={pathname.startsWith("/courses")}
        />
        <NavItem
          prefix={prefix}
          to="/grades"
          icon={GraduationCap}
          label="Grades"
          active={pathname.startsWith("/grades")}
        />
        <NavItem
          prefix={prefix}
          to="/notifications"
          icon={Bell}
          label="Notifications"
          active={pathname.startsWith("/notifications")}
        />
        <p className={`${prefix}-nav-label`}>Account</p>
        <NavItem
          prefix={prefix}
          to="/profile"
          icon={Settings}
          label="Profile"
          active={pathname.startsWith("/profile")}
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
