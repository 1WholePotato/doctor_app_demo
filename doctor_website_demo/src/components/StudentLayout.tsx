import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { BookOpen, Menu, X } from "lucide-react";
import StudentSidebar from "./StudentSidebar";
import "../styles/studentLayout.css";
import "../styles/studentPages.css";

export default function StudentLayout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [prevPath, setPrevPath] = useState(location.pathname);

  if (prevPath !== location.pathname) {
    setPrevPath(location.pathname);
    setMobileOpen(false);
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="student-layout-shell">
      {/* Mobile Topbar */}
      <header className="student-mobile-topbar">
        <button
          type="button"
          className="student-hamburger"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className="student-mobile-title">
          <BookOpen size={18} color="var(--s-teal)" />
          MedLearn <span>Student Portal</span>
        </div>
      </header>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="student-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar with mobile drawer support */}
      <div className={`student-sidebar-container${mobileOpen ? " open" : ""}`}>
        <StudentSidebar prefix="sl" onCloseMobile={() => setMobileOpen(false)} />
      </div>

      <div className="student-layout-content">
        <Outlet />
      </div>
    </div>
  );
}
