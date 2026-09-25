import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { BookOpen, Menu, X } from "lucide-react";
import AdminSidebar from "./AdminSidebar";
import "../styles/adminLayout.css";
import "../styles/adminPages.css";

export default function AdminLayout() {
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
    <div className="admin-layout-shell">
      {/* Mobile Topbar */}
      <header className="admin-mobile-topbar">
        <button
          type="button"
          className="admin-hamburger"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className="admin-mobile-title">
          <BookOpen size={18} color="var(--gold)" />
          Dr <span>Admin</span>
        </div>
      </header>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="admin-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar with mobile drawer support */}
      <div className={`admin-sidebar-container${mobileOpen ? " open" : ""}`}>
        <AdminSidebar onCloseMobile={() => setMobileOpen(false)} />
      </div>

      <div className="admin-layout-content">
        <Outlet />
      </div>
    </div>
  );
}
