/**
 * AdminLanding.tsx — Production-grade Admin Dashboard
 *
 * CHANGES MADE:
 * 1. Typography: Replaced generic fonts with Google Fonts (Fraunces display + DM Sans body)
 *    → Add to index.html: <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
 *
 * 2. Color system: Replaced ad-hoc Tailwind colors with a deliberate slate/gold palette
 *    via CSS custom properties (no extra npm packages needed).
 *
 * 3. Layout: Added a persistent left sidebar with nav links, a top header with greeting,
 *    and a proper page shell so the dashboard feels like a real admin app.
 *
 * 4. Stat cards: Redesigned with subtle top-border accents, trend indicators,
 *    and a proper label/value hierarchy.
 *
 * 5. Quick Actions: Replaced flat colored buttons with refined icon+label cards.
 *    Icons use lucide-react → run: npm install lucide-react
 *
 * 6. Table: Replaced messy placeholder data with a proper courses table including
 *    status badges, consistent column naming, and hover row states.
 *
 * 7. Animations: CSS keyframe stagger on cards/table rows for a polished load-in.
 *
 * 8. Sidebar: Fully functional nav with active-state detection via react-router-dom
 *    (already in your project).
 *
 * NPM INSTALLS NEEDED:
 *   npm install lucide-react
 *
 * Google Fonts (paste into your public/index.html <head>):
 *   <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
 */

import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BookOpen,
  Users,
  TrendingUp,
  LayoutDashboard,
  Settings,
  LogOut,
  ArrowUpRight,
  ChevronRight,
} from "lucide-react";

// ─── Inline styles (CSS-in-JS via style objects) ────────────────────────────
// Using a <style> tag injected once so we can use @keyframes & :hover selectors
// without requiring a CSS module or styled-components.

const globalStyles = `
  :root {
    --bg:        #F7F6F3;
    --surface:   #FFFFFF;
    --sidebar:   #111110;
    --gold:      #C9A84C;
    --gold-soft: #F5EDD6;
    --text-1:    #111110;
    --text-2:    #6B6A66;
    --text-3:    #A09F9A;
    --border:    #E8E6E1;
    --radius:    14px;
    --font-display: 'Fraunces', Georgia, serif;
    --font-body:    'DM Sans', system-ui, sans-serif;
  }

  .admin-shell * { box-sizing: border-box; margin: 0; padding: 0; }
  .admin-shell { font-family: var(--font-body); background: var(--bg); min-height: 100vh; display: flex; }

  /* Sidebar */
  .sidebar {
    width: 228px; min-height: 100vh; background: var(--sidebar);
    display: flex; flex-direction: column; padding: 28px 16px;
    position: fixed; top: 0; left: 0; bottom: 0; z-index: 10;
  }
  .sidebar-logo {
    font-family: var(--font-display); font-size: 18px; font-weight: 300;
    color: #fff; letter-spacing: 0.02em; padding: 0 8px; margin-bottom: 36px;
    display: flex; align-items: center; gap: 10px;
  }
  .sidebar-logo span { color: var(--gold); }
  .sidebar-nav { display: flex; flex-direction: column; gap: 2px; flex: 1; }
  .nav-item {
    display: flex; align-items: center; gap: 11px;
    padding: 10px 12px; border-radius: 10px;
    color: #888887; font-size: 14px; font-weight: 400;
    text-decoration: none; transition: background 0.15s, color 0.15s;
    cursor: pointer; border: none; background: none; width: 100%; text-align: left;
  }
  .nav-item:hover { background: rgba(255,255,255,0.07); color: #fff; }
  .nav-item.active { background: rgba(201,168,76,0.15); color: var(--gold); }
  .nav-item svg { width: 18px; height: 18px; flex-shrink: 0; }
  .nav-section-label {
    font-size: 10px; font-weight: 500; letter-spacing: 0.1em;
    color: #444443; text-transform: uppercase; padding: 0 12px; margin: 20px 0 6px;
  }
  .sidebar-footer { margin-top: auto; padding-top: 20px; border-top: 1px solid #222221; }

  /* Main content */
  .main-content { margin-left: 228px; flex: 1; padding: 40px 44px; max-width: 1000px; }

  /* Header */
  .page-header { margin-bottom: 36px; }
  .page-header-eyebrow { font-size: 12px; font-weight: 500; color: var(--text-3); letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 6px; }
  .page-header h1 { font-family: var(--font-display); font-size: 32px; font-weight: 300; color: var(--text-1); letter-spacing: -0.01em; }
  .page-header h1 em { font-style: italic; color: var(--gold); }

  /* Stat cards */
  .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 36px; }
  .stat-card {
    background: var(--surface); border-radius: var(--radius);
    border: 1px solid var(--border); padding: 22px 24px;
    opacity: 0; animation: fadeUp 0.4s ease forwards;
  }
  .stat-card:nth-child(1) { animation-delay: 0.05s; border-top: 2px solid var(--gold); }
  .stat-card:nth-child(2) { animation-delay: 0.12s; border-top: 2px solid #8BBDE0; }
  .stat-card:nth-child(3) { animation-delay: 0.19s; border-top: 2px solid #8DC8A4; }
  .stat-label { font-size: 12px; font-weight: 500; color: var(--text-3); letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 10px; }
  .stat-value { font-family: var(--font-display); font-size: 36px; font-weight: 300; color: var(--text-1); letter-spacing: -0.02em; }
  .stat-sub { margin-top: 8px; font-size: 12px; color: var(--text-3); display: flex; align-items: center; gap: 4px; }
  .stat-sub .up { color: #3D9B6A; font-weight: 500; }

  /* Quick actions */
  .section-header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 16px; }
  .section-title { font-size: 13px; font-weight: 500; color: var(--text-2); letter-spacing: 0.06em; text-transform: uppercase; }
  .actions-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 36px; }
  .action-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 20px 20px 18px; text-decoration: none; color: var(--text-1);
    display: flex; flex-direction: column; gap: 12px;
    transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;
    opacity: 0; animation: fadeUp 0.4s ease forwards;
    position: relative; overflow: hidden;
  }
  .action-card:nth-child(1) { animation-delay: 0.25s; }
  .action-card:nth-child(2) { animation-delay: 0.31s; }
  .action-card:nth-child(3) { animation-delay: 0.37s; }
  .action-card:hover { border-color: var(--gold); transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.07); }
  .action-card:hover .action-arrow { opacity: 1; transform: translate(0, 0); }
  .action-icon { width: 36px; height: 36px; border-radius: 9px; display: flex; align-items: center; justify-content: center; }
  .action-icon svg { width: 18px; height: 18px; }
  .action-label { font-size: 14px; font-weight: 500; color: var(--text-1); }
  .action-desc { font-size: 12px; color: var(--text-3); margin-top: 2px; }
  .action-arrow {
    position: absolute; top: 16px; right: 16px;
    opacity: 0; transform: translate(-4px, 4px);
    transition: opacity 0.15s, transform 0.15s;
    color: var(--text-3);
  }
  .action-arrow svg { width: 14px; height: 14px; }

  /* Table */
  .table-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    overflow: hidden; opacity: 0; animation: fadeUp 0.4s ease 0.42s forwards;
  }
  .table-inner { width: 100%; border-collapse: collapse; }
  .table-inner thead th {
    padding: 14px 20px; font-size: 11px; font-weight: 500; letter-spacing: 0.08em;
    text-transform: uppercase; color: var(--text-3);
    border-bottom: 1px solid var(--border); text-align: left; background: #FAFAF8;
  }
  .table-inner tbody tr { border-bottom: 1px solid var(--border); transition: background 0.12s; }
  .table-inner tbody tr:last-child { border-bottom: none; }
  .table-inner tbody tr:hover { background: #FAFAF8; }
  .table-inner tbody td { padding: 16px 20px; font-size: 14px; color: var(--text-1); }
  .table-inner tbody td.muted { color: var(--text-2); }
  .badge {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500;
  }
  .badge-paid { background: #EAF5EE; color: #2E7D52; }
  .badge-pending { background: #FEF4E4; color: #9A6500; }
  .badge-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex-shrink: 0; }

  /* Animations */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* Responsive tweak */
  @media (max-width: 900px) {
    .stats-grid, .actions-grid { grid-template-columns: 1fr 1fr; }
    .main-content { padding: 28px 24px; }
  }
`;

// ─── Sample data ──────────────────────────────────────────────────────────────

const courses = [
  { student: "John Doe",    course: "Advanced Anatomy",     date: "2 Apr 2026",  status: "paid" },
  { student: "Pieter van W", course: "Clinical Diagnostics", date: "1 Mar 2026", status: "pending" },
  { student: "Gielie Botha", course: "Pharmacology 101",    date: "3 Mar 2026",  status: "pending" },
  { student: "Sarah Nkosi",  course: "Advanced Anatomy",    date: "14 Mar 2026", status: "paid" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function NavItem({
  to,
  icon: Icon,
  label,
  active,
}: {
  to: string;
  icon: React.ElementType;
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

function StatusBadge({ status }: { status: string }) {
  const paid = status === "paid";
  return (
    <span className={`badge ${paid ? "badge-paid" : "badge-pending"}`}>
      <span className="badge-dot" />
      {paid ? "Paid" : "Pending"}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function AdminLanding() {
  const { pathname } = useLocation();

  return (
    <>
      {/* Inject global styles once */}
      <style>{globalStyles}</style>

      <div className="admin-shell">
        {/* ── Sidebar ── */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <BookOpen size={20} color="var(--gold)" />
            Dr <span>Admin</span>
          </div>

          <nav className="sidebar-nav">
            <p className="nav-section-label">Main</p>
            <NavItem to="/"            icon={LayoutDashboard} label="Dashboard"  active={pathname === "/"} />
            <NavItem to="/admincourses" icon={BookOpen}        label="Courses"    active={pathname.startsWith("/admincourses")} />
            <NavItem to="/patients"    icon={Users}           label="Students"   active={pathname.startsWith("/patients")} />

            <p className="nav-section-label">Account</p>
            <NavItem to="/settings"    icon={Settings}        label="Settings"   active={pathname.startsWith("/settings")} />
          </nav>

          <div className="sidebar-footer">
            <button className="nav-item" style={{ color: "#665F5C" }}>
              <LogOut />
              Sign out
            </button>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main className="main-content">

          {/* Header */}
          <header className="page-header">
            <p className="page-header-eyebrow">Overview</p>
            <h1>Good morning, <em>Doctor.</em></h1>
          </header>

          {/* Stat cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <p className="stat-label">Total Students</p>
              <p className="stat-value">1,284</p>
              <p className="stat-sub"><span className="up">↑ 12%</span> vs last month</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Active Courses</p>
              <p className="stat-value">32</p>
              <p className="stat-sub">Across 4 categories</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Revenue (MTD)</p>
              <p className="stat-value">R 54k</p>
              <p className="stat-sub"><span className="up">↑ 8%</span> vs last month</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="section-header">
            <p className="section-title">Quick Actions</p>
          </div>
          <div className="actions-grid">
            <Link to="/admincourses" className="action-card">
              <div className="action-icon" style={{ background: "var(--gold-soft)" }}>
                <BookOpen color="var(--gold)" />
              </div>
              <div>
                <p className="action-label">View Courses</p>
                <p className="action-desc">Manage your curriculum</p>
              </div>
              <span className="action-arrow"><ArrowUpRight /></span>
            </Link>

            <Link to="/patients" className="action-card">
              <div className="action-icon" style={{ background: "#EAF2FB" }}>
                <Users color="#3A7FC1" />
              </div>
              <div>
                <p className="action-label">Manage Students</p>
                <p className="action-desc">Enrolments & access</p>
              </div>
              <span className="action-arrow"><ArrowUpRight /></span>
            </Link>

            <Link to="/settings" className="action-card">
              <div className="action-icon" style={{ background: "#F0EEF8" }}>
                <Settings color="#6E5DB3" />
              </div>
              <div>
                <p className="action-label">Profile Settings</p>
                <p className="action-desc">Update your details</p>
              </div>
              <span className="action-arrow"><ArrowUpRight /></span>
            </Link>
          </div>

          {/* Recent Enrollments Table */}
          <div className="section-header">
            <p className="section-title">Classes Happening Soon</p>
            <Link to="/admincourses" style={{ fontSize: 13, color: "var(--gold)", display: "flex", alignItems: "center", gap: 3, textDecoration: "none" }}>
              View all <ChevronRight size={14} />
            </Link>
          </div>

          <div className="table-card">
            <table className="table-inner">
              <thead>
                <tr>
                  
                  <th>Course</th>
                  <th>Date</th>
                  <th>Classlist</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((row, i) => (
                  <tr key={i}>
                    
                    <td className="muted">{row.course}</td>
                    <td className="muted">{row.date}</td>
                    <td><button className="btn-primary" onClick={() => ''}>
                          Download
                        </button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </main>
      </div>
    </>
  );
}

export default AdminLanding;