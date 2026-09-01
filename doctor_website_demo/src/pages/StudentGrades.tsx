/**
 * StudentGrades.tsx — Student-facing grades page
 *
 * Shows all enrolled courses with:
 * - Status badge: Busy (amber) / Passed (teal) / Failed (red)
 * - If Passed + cert uploaded → Download Certificate button
 * - Summary stats strip at the top
 *
 * Supabase wiring (when ready):
 *   const { data } = await supabase
 *     .from("enrollments")
 *     .select("*, courses(*), certificate_url, status")
 *     .eq("student_id", user.id)
 *
 * NPM: lucide-react (already installed)
 */
 
import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BookOpen, LayoutDashboard, Settings, LogOut,
  Bell, GraduationCap, Download, Clock, CheckCircle, XCircle, CalendarDays,
} from "lucide-react";
 
const styles = `
  :root {
    --s-bg:       #F4F7FB;
    --s-surface:  #FFFFFF;
    --s-navy:     #0F1E35;
    --s-teal:     #2BBFAA;
    --s-teal-soft:#E6F7F5;
    --s-teal-mid: #1A9E8C;
    --s-text-1:   #0F1E35;
    --s-text-2:   #4A5568;
    --s-text-3:   #94A3B8;
    --s-border:   #E2E8F0;
    --s-radius:   12px;
    --s-font:     'Plus Jakarta Sans', system-ui, sans-serif;
  }
 
  .sg-shell * { box-sizing: border-box; margin: 0; padding: 0; }
  .sg-shell { font-family: var(--s-font); background: var(--s-bg); min-height: 100vh; display: flex; }
 
  .sl-sidebar { width: 224px; min-height: 100vh; background: var(--s-navy); display: flex; flex-direction: column; padding: 26px 14px; position: fixed; top: 0; left: 0; bottom: 0; z-index: 10; }
  .sl-logo { display: flex; align-items: center; gap: 10px; padding: 0 8px; margin-bottom: 32px; }
  .sl-logo-mark { width: 30px; height: 30px; border-radius: 8px; background: var(--s-teal); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .sl-logo-mark svg { width: 16px; height: 16px; color: #fff; }
  .sl-logo-text { font-size: 14px; font-weight: 600; color: #fff; line-height: 1.2; }
  .sl-logo-text span { display: block; font-size: 11px; font-weight: 400; color: #4A6080; }
  .sl-nav { display: flex; flex-direction: column; gap: 2px; flex: 1; }
  .sl-nav-label { font-size: 10px; font-weight: 600; letter-spacing: .08em; color: #2D3F58; text-transform: uppercase; padding: 0 10px; margin: 18px 0 5px; }
  .sl-nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 9px; color: #64748B; font-size: 13px; font-weight: 400; text-decoration: none; transition: background .15s, color .15s; cursor: pointer; border: none; background: none; width: 100%; text-align: left; }
  .sl-nav-item:hover { background: rgba(255,255,255,.06); color: #CBD5E1; }
  .sl-nav-item.active { background: rgba(43,191,170,.15); color: var(--s-teal); font-weight: 500; }
  .sl-nav-item svg { width: 17px; height: 17px; flex-shrink: 0; }
  .sl-footer { margin-top: auto; padding-top: 18px; border-top: 1px solid #1E3050; }
  .sl-avatar-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; margin-bottom: 10px; }
  .sl-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--s-teal); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; color: #fff; flex-shrink: 0; }
  .sl-avatar-name { font-size: 13px; font-weight: 500; color: #CBD5E1; }
  .sl-avatar-role { font-size: 11px; color: #4A6080; }
 
  .sg-main { margin-left: 224px; flex: 1; padding: 32px 40px; }
 
  /* Header */
  .sg-header { margin-bottom: 24px; }
  .sg-header .eyebrow { font-size: 11px; font-weight: 600; color: var(--s-text-3); letter-spacing: .07em; text-transform: uppercase; margin-bottom: 5px; }
  .sg-header h1 { font-size: 28px; font-weight: 600; color: var(--s-text-1); letter-spacing: -.02em; }
 
  /* Stats strip */
  .sg-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 28px; }
  .sg-stat { background: var(--s-surface); border: 1px solid var(--s-border); border-radius: var(--s-radius); padding: 18px 20px; opacity: 0; animation: fadeUp .35s ease forwards; }
  .sg-stat:nth-child(1) { animation-delay: .05s; border-top: 2.5px solid var(--s-teal); }
  .sg-stat:nth-child(2) { animation-delay: .11s; border-top: 2.5px solid #F59E0B; }
  .sg-stat:nth-child(3) { animation-delay: .17s; border-top: 2.5px solid #EF4444; }
  .sg-stat-label { font-size: 10px; font-weight: 600; color: var(--s-text-3); letter-spacing: .07em; text-transform: uppercase; margin-bottom: 8px; }
  .sg-stat-val { font-size: 28px; font-weight: 600; color: var(--s-text-1); line-height: 1; }
 
  /* Section title */
  .s-title { font-size: 12px; font-weight: 700; color: var(--s-text-2); letter-spacing: .07em; text-transform: uppercase; margin-bottom: 14px; }
 
  /* Course grade cards */
  .sg-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
  .sg-card {
    background: var(--s-surface); border: 1px solid var(--s-border); border-radius: var(--s-radius);
    padding: 20px; display: flex; flex-direction: column; gap: 12px;
    opacity: 0; animation: fadeUp .35s ease forwards;
  }
  .sg-card:nth-child(1){animation-delay:.22s} .sg-card:nth-child(2){animation-delay:.28s}
  .sg-card:nth-child(3){animation-delay:.34s} .sg-card:nth-child(4){animation-delay:.40s}
  .sg-card:nth-child(5){animation-delay:.46s}
 
  .sg-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
  .sg-card-title { font-size: 14px; font-weight: 600; color: var(--s-text-1); line-height: 1.35; }
  .sg-card-meta { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--s-text-3); }
  .sg-card-meta svg { width: 13px; height: 13px; }
  .sg-card-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 12px; border-top: 1px solid var(--s-border); }
 
  /* Status badges */
  .status-badge { display: inline-flex; align-items: center; gap: 5px; padding: 4px 11px; border-radius: 20px; font-size: 11px; font-weight: 600; }
  .status-busy   { background: #FFFBEB; color: #D97706; }
  .status-passed { background: var(--s-teal-soft); color: var(--s-teal-mid); }
  .status-failed { background: #FEE9E9; color: #DC2626; }
  .status-dot    { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
 
  /* Download button */
  .dl-btn { display: inline-flex; align-items: center; gap: 6px; background: var(--s-navy); color: #fff; border: none; padding: 8px 14px; border-radius: 8px; font-family: var(--s-font); font-size: 12px; font-weight: 500; cursor: pointer; text-decoration: none; transition: opacity .15s; }
  .dl-btn:hover { opacity: .85; }
  .dl-btn svg { width: 13px; height: 13px; }
  .no-cert { font-size: 12px; color: var(--s-text-3); font-style: italic; }
 
  @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
`;
 
// ─── Types & dummy data ───────────────────────────────────────────────────────
 
type Status = "busy" | "passed" | "failed";
 
interface Enrollment {
  id: number;
  courseTitle: string;
  category: string;
  sessionDate: string;
  status: Status;
  certificateUrl: string | null; // null = not yet uploaded
}
 
const DUMMY_ENROLLMENTS: Enrollment[] = [
  { id: 1, courseTitle: "CPR Training",              category: "Emergency",    sessionDate: "10 Apr 2026", status: "passed", certificateUrl: "/dummy-cert.pdf" },
  { id: 2, courseTitle: "First Aid Crash Course",    category: "Emergency",    sessionDate: "15 Apr 2026", status: "busy",   certificateUrl: null },
  { id: 3, courseTitle: "Advanced Human Anatomy",    category: "Anatomy",      sessionDate: "22 Apr 2026", status: "failed", certificateUrl: null },
  { id: 4, courseTitle: "Clinical Pharmacology",     category: "Pharmacology", sessionDate: "28 Apr 2026", status: "passed", certificateUrl: null }, // passed but cert not uploaded yet
  { id: 5, courseTitle: "Diagnostic Imaging",        category: "Diagnostics",  sessionDate: "5 May 2026",  status: "busy",   certificateUrl: null },
];
 
// ─── Helpers ──────────────────────────────────────────────────────────────────
 
function StatusBadge({ status }: { status: Status }) {
  const map = {
    busy:   { label: "In progress", cls: "status-busy",   Icon: Clock },
    passed: { label: "Passed",      cls: "status-passed", Icon: CheckCircle },
    failed: { label: "Failed",      cls: "status-failed", Icon: XCircle },
  };
  const { label, cls, Icon } = map[status];
  return (
    <span className={`status-badge ${cls}`}>
      <span className="status-dot" />{label}
    </span>
  );
}
 
function NavItem({ to, icon: Icon, label, active }: { to: string; icon: React.ElementType; label: string; active: boolean }) {
  return (
    <Link to={to} className={`sl-nav-item${active ? " active" : ""}`}>
      <Icon />{label}
    </Link>
  );
}
 
// ─── Main component ───────────────────────────────────────────────────────────
 
export default function StudentGrades() {
  const { pathname } = useLocation();
 
  const passed = DUMMY_ENROLLMENTS.filter(e => e.status === "passed").length;
  const busy   = DUMMY_ENROLLMENTS.filter(e => e.status === "busy").length;
  const failed = DUMMY_ENROLLMENTS.filter(e => e.status === "failed").length;
 
  return (
    <>
      <style>{styles}</style>
      <div className="sg-shell">
 
        <aside className="sl-sidebar">
          <div className="sl-logo">
            <div className="sl-logo-mark"><BookOpen /></div>
            <div className="sl-logo-text">MedLearn<span>Student Portal</span></div>
          </div>
          <nav className="sl-nav">
            <p className="sl-nav-label">Menu</p>
            <NavItem to="/studentlanding" icon={LayoutDashboard} label="Dashboard"     active={pathname === "/studentlanding"} />
            <NavItem to="/courses"        icon={BookOpen}        label="My Courses"    active={pathname.startsWith("/courses")} />
            <NavItem to="/grades"         icon={GraduationCap}   label="Grades"        active={pathname.startsWith("/grades")} />
            <NavItem to="/notifications"  icon={Bell}            label="Notifications" active={pathname.startsWith("/notifications")} />
            <p className="sl-nav-label">Account</p>
            <NavItem to="/settings"       icon={Settings}        label="Settings"      active={pathname.startsWith("/settings")} />
          </nav>
          <div className="sl-footer">
            <div className="sl-avatar-row">
              <div className="sl-avatar">JS</div>
              <div>
                <p className="sl-avatar-name">John Student</p>
                <p className="sl-avatar-role">student123@gmail.com</p>
              </div>
            </div>
            <button className="sl-nav-item" style={{ color: "#4A6080" }}><LogOut />Sign out</button>
          </div>
        </aside>
 
        <main className="sg-main">
          <div className="sg-header">
            <p className="eyebrow">Academic record</p>
            <h1>My grades</h1>
          </div>
 
          {/* Stats */}
          <div className="sg-stats">
            <div className="sg-stat">
              <p className="sg-stat-label">Passed</p>
              <p className="sg-stat-val">{passed}</p>
            </div>
            <div className="sg-stat">
              <p className="sg-stat-label">In progress</p>
              <p className="sg-stat-val">{busy}</p>
            </div>
            <div className="sg-stat">
              <p className="sg-stat-label">Failed</p>
              <p className="sg-stat-val">{failed}</p>
            </div>
          </div>
 
          <p className="s-title">All courses</p>
          <div className="sg-grid">
            {DUMMY_ENROLLMENTS.map((e) => (
              <div className="sg-card" key={e.id}>
                <div className="sg-card-top">
                  <div>
                    <p className="sg-card-title">{e.courseTitle}</p>
                    <p className="sg-card-meta" style={{ marginTop: 4 }}>
                      <CalendarDays />{e.sessionDate}
                    </p>
                  </div>
                  <StatusBadge status={e.status} />
                </div>
 
                <div className="sg-card-footer">
                  <span style={{ fontSize: 11, color: "var(--s-text-3)", background: "var(--s-bg)", border: "1px solid var(--s-border)", padding: "2px 9px", borderRadius: 20, fontWeight: 500 }}>
                    {e.category}
                  </span>
 
                  {e.status === "passed" ? (
                    e.certificateUrl ? (
                      <a href={e.certificateUrl} download className="dl-btn">
                        <Download />Download certificate
                      </a>
                    ) : (
                      <span className="no-cert">Certificate pending…</span>
                    )
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </>
  );
}