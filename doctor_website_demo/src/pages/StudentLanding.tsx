/**
 * StudentLanding.tsx — Production-grade Student Dashboard
 *
 * DESIGN SYSTEM: Intentionally different from the admin dark/gold theme.
 * - Palette: Deep navy sidebar (#0F1E35) + off-white bg (#F4F7FB) + teal accent (#2BBFAA)
 * - Typography: Plus Jakarta Sans (rounded, approachable, modern medical feel)
 *   → Add to index.html: <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
 * - Signature element: The "next session" countdown strip at the top of the page — 
 *   a full-width banner that immediately orients the student to what's coming next.
 *
 * SECTIONS:
 * 1. Sidebar nav (navy, teal active state)
 * 2. Welcome header with next-session countdown banner
 * 3. Upcoming classes — horizontal scroll card strip
 * 4. Grades — progress bar style (more readable than raw numbers)
 * 5. Notifications — clean feed with type icons
 *
 * NPM: lucide-react (already installed)
 * Google Fonts: add Plus Jakarta Sans link to public/index.html
 */

import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BookOpen, LayoutDashboard, Settings, LogOut,
  Bell, GraduationCap, CalendarDays, ChevronRight, Clock,
} from "lucide-react";

// ─── Styles ───────────────────────────────────────────────────────────────────

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

  .sl-shell * { box-sizing: border-box; margin: 0; padding: 0; }
  .sl-shell { font-family: var(--s-font); background: var(--s-bg); min-height: 100vh; display: flex; }

  /* ── Sidebar ── */
  .sl-sidebar { width: 224px; min-height: 100vh; background: var(--s-navy); display: flex; flex-direction: column; padding: 26px 14px; position: fixed; top: 0; left: 0; bottom: 0; z-index: 10; }
  .sl-logo { display: flex; align-items: center; gap: 10px; padding: 0 8px; margin-bottom: 32px; }
  .sl-logo-mark { width: 30px; height: 30px; border-radius: 8px; background: var(--s-teal); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .sl-logo-mark svg { width: 16px; height: 16px; color: #fff; }
  .sl-logo-text { font-size: 14px; font-weight: 600; color: #fff; letter-spacing: -.01em; line-height: 1.2; }
  .sl-logo-text span { display: block; font-size: 11px; font-weight: 400; color: #64748B; }
  .sl-nav { display: flex; flex-direction: column; gap: 2px; flex: 1; }
  .sl-nav-label { font-size: 10px; font-weight: 600; letter-spacing: .08em; color: #2D3F58; text-transform: uppercase; padding: 0 10px; margin: 18px 0 5px; }
  .sl-nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 9px; color: #64748B; font-size: 13px; font-weight: 400; text-decoration: none; transition: background .15s, color .15s; cursor: pointer; border: none; background: none; width: 100%; text-align: left; }
  .sl-nav-item:hover { background: rgba(255,255,255,.06); color: #CBD5E1; }
  .sl-nav-item.active { background: rgba(43,191,170,.15); color: var(--s-teal); font-weight: 500; }
  .sl-nav-item svg { width: 17px; height: 17px; flex-shrink: 0; }
  .sl-footer { margin-top: auto; padding-top: 18px; border-top: 1px solid #1E3050; }

  /* ── Avatar in sidebar ── */
  .sl-avatar-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; margin-bottom: 10px; }
  .sl-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--s-teal); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; color: #fff; flex-shrink: 0; }
  .sl-avatar-name { font-size: 13px; font-weight: 500; color: #CBD5E1; }
  .sl-avatar-role { font-size: 11px; color: #4A6080; }

  /* ── Main ── */
  .sl-main { margin-left: 224px; flex: 1; padding: 32px 40px; }

  /* ── Header ── */
  .sl-header { margin-bottom: 24px; }
  .sl-header .eyebrow { font-size: 11px; font-weight: 600; color: var(--s-text-3); letter-spacing: .07em; text-transform: uppercase; margin-bottom: 5px; }
  .sl-header h1 { font-size: 28px; font-weight: 600; color: var(--s-text-1); letter-spacing: -.02em; }
  .sl-header h1 span { color: var(--s-teal); }

  /* ── Next session banner ── */
  .next-banner {
    background: var(--s-navy); border-radius: var(--s-radius);
    padding: 18px 24px; display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 28px;
    opacity: 0; animation: fadeUp .35s ease .05s forwards;
  }
  .nb-left { display: flex; align-items: center; gap: 14px; }
  .nb-icon { width: 40px; height: 40px; border-radius: 10px; background: rgba(43,191,170,.15); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .nb-icon svg { width: 20px; height: 20px; color: var(--s-teal); }
  .nb-label { font-size: 11px; font-weight: 600; color: #4A6080; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 3px; }
  .nb-title { font-size: 15px; font-weight: 600; color: #fff; }
  .nb-meta { font-size: 12px; color: #64748B; margin-top: 2px; }
  .nb-right { display: flex; align-items: center; gap: 20px; }
  .nb-countdown { text-align: center; }
  .nb-count-val { font-size: 22px; font-weight: 600; color: var(--s-teal); line-height: 1; }
  .nb-count-label { font-size: 10px; color: #4A6080; margin-top: 3px; text-transform: uppercase; letter-spacing: .05em; }
  .nb-divider { width: 1px; height: 36px; background: #1E3050; }
  .nb-btn { background: var(--s-teal); color: #fff; border: none; padding: 9px 18px; border-radius: 8px; font-family: var(--s-font); font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap; }

  /* ── Section header ── */
  .s-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  .s-title { font-size: 12px; font-weight: 600; color: var(--s-text-2); letter-spacing: .06em; text-transform: uppercase; }
  .s-link { display: flex; align-items: center; gap: 3px; font-size: 12px; color: var(--s-teal); text-decoration: none; font-weight: 500; }
  .s-link svg { width: 13px; height: 13px; }

  /* ── Upcoming classes ── */
  .classes-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 28px; }
  .class-card {
    background: var(--s-surface); border: 1px solid var(--s-border); border-radius: var(--s-radius);
    padding: 18px; display: flex; flex-direction: column; gap: 10px;
    opacity: 0; animation: fadeUp .35s ease forwards;
  }
  .class-card:nth-child(1) { animation-delay: .1s }
  .class-card:nth-child(2) { animation-delay: .16s }
  .class-card:nth-child(3) { animation-delay: .22s }
  .cc-date-badge { display: inline-flex; align-items: center; gap: 5px; background: var(--s-teal-soft); color: var(--s-teal-mid); font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 6px; width: fit-content; }
  .cc-date-badge svg { width: 12px; height: 12px; }
  .cc-title { font-size: 14px; font-weight: 600; color: var(--s-text-1); line-height: 1.3; }
  .cc-meta { font-size: 12px; color: var(--s-text-3); display: flex; align-items: center; gap: 5px; }
  .cc-meta svg { width: 13px; height: 13px; }

  /* ── Bottom grid ── */
  .bottom-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

  /* ── Grades card ── */
  .grades-card {
    background: var(--s-surface); border: 1px solid var(--s-border); border-radius: var(--s-radius);
    padding: 22px; opacity: 0; animation: fadeUp .35s ease .28s forwards;
  }
  .grade-row { display: flex; flex-direction: column; gap: 5px; margin-bottom: 16px; }
  .grade-row:last-child { margin-bottom: 0; }
  .grade-top { display: flex; align-items: center; justify-content: space-between; }
  .grade-name { font-size: 13px; font-weight: 500; color: var(--s-text-1); }
  .grade-pct { font-size: 13px; font-weight: 600; color: var(--s-text-1); }
  .grade-bar-bg { height: 6px; background: var(--s-border); border-radius: 99px; overflow: hidden; }
  .grade-bar-fill { height: 100%; border-radius: 99px; background: var(--s-teal); transition: width .6s ease; }
  .grade-bar-fill.warn { background: #F59E0B; }
  .grade-bar-fill.low  { background: #EF4444; }

  /* ── Notifications card ── */
  .notif-card {
    background: var(--s-surface); border: 1px solid var(--s-border); border-radius: var(--s-radius);
    padding: 22px; opacity: 0; animation: fadeUp .35s ease .34s forwards;
  }
  .notif-item { display: flex; align-items: flex-start; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--s-border); }
  .notif-item:last-child { border-bottom: none; padding-bottom: 0; }
  .notif-dot-wrap { width: 32px; height: 32px; border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
  .notif-dot-wrap svg { width: 16px; height: 16px; }
  .notif-dot-wrap.info  { background: #EFF6FF; color: #3B82F6; }
  .notif-dot-wrap.success { background: var(--s-teal-soft); color: var(--s-teal); }
  .notif-dot-wrap.warn  { background: #FFFBEB; color: #D97706; }
  .notif-text { font-size: 13px; font-weight: 500; color: var(--s-text-1); line-height: 1.4; }
  .notif-time { font-size: 11px; color: var(--s-text-3); margin-top: 3px; }

  @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
`;

// ─── Data ─────────────────────────────────────────────────────────────────────

const CLASSES = [
  { title: "CPR Training",           date: "2 Apr 2026",  location: "Cape Town Med Centre", time: "09:00 – 12:00" },
  { title: "Lobotomy 101",           date: "1 Apr 2026",  location: "JHB Health Campus",    time: "14:00 – 16:00" },
  { title: "First Aid Crash Course", date: "17 Apr 2026", location: "Pretoria Univ Hospital", time: "08:30 – 11:30" },
];

const GRADES = [
  { name: "First Aid",   pct: 62 },
  { name: "CPR",         pct: 42 },
  { name: "Lobotomy 101", pct: 60 },
];

const NOTIFICATIONS = [
  { type: "success", text: "New course available — Diagnostic Imaging",  time: "2 hours ago" },
  { type: "info",    text: "First Aid grades are now published",          time: "Yesterday" },
  { type: "warn",    text: "You have a pending session to confirm",       time: "3 days ago" },
];

function gradeClass(pct: number) {
  if (pct >= 65) return "";
  if (pct >= 50) return "warn";
  return "low";
}

// ─── Sidebar nav item ─────────────────────────────────────────────────────────

function NavItem({ to, icon: Icon, label, active }: { to: string; icon: React.ElementType; label: string; active: boolean }) {
  return (
    <Link to={to} className={`sl-nav-item${active ? " active" : ""}`}>
      <Icon />{label}
    </Link>
  );
}

// ─── Notification icon ────────────────────────────────────────────────────────

function NotifIcon({ type }: { type: string }) {
  if (type === "success") return <BookOpen />;
  if (type === "warn")    return <Clock />;
  return <Bell />;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StudentLanding() {
  const { pathname } = useLocation();

  return (
    <>
      <style>{styles}</style>
      <div className="sl-shell">

        {/* ── Sidebar ── */}
        <aside className="sl-sidebar">
          <div className="sl-logo">
            <div className="sl-logo-mark"><BookOpen /></div>
            <div className="sl-logo-text">
              MedLearn
              <span>Student Portal</span>
            </div>
          </div>

          <nav className="sl-nav">
            <p className="sl-nav-label">Menu</p>
            <NavItem to="/studentlanding" icon={LayoutDashboard} label="Dashboard" active={pathname === "/studentlanding"} />
            <NavItem to="/courses"        icon={BookOpen}        label="My Courses" active={pathname.startsWith("/courses")} />
            <NavItem to="/grades"         icon={GraduationCap}   label="Grades"     active={pathname.startsWith("/grades")} />
            <NavItem to="/notifications"  icon={Bell}            label="Notifications" active={pathname.startsWith("/notifications")} />
            <p className="sl-nav-label">Account</p>
            <NavItem to="/settings"       icon={Settings}        label="Settings"   active={pathname.startsWith("/settings")} />
          </nav>

          <div className="sl-footer">
            <div className="sl-avatar-row">
              <div className="sl-avatar">JS</div>
              <div>
                <p className="sl-avatar-name">John Student</p>
                <p className="sl-avatar-role">student123@gmail.com</p>
              </div>
            </div>
            <button className="sl-nav-item" style={{ color: "#4A6080" }}>
              <LogOut />Sign out
            </button>
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="sl-main">

          {/* Header */}
          <div className="sl-header">
            <p className="eyebrow">Student dashboard</p>
            <h1>Welcome back, <span>John.</span></h1>
          </div>

          {/* Next session banner */}
          <div className="next-banner">
            <div className="nb-left">
              <div className="nb-icon"><CalendarDays /></div>
              <div>
                <p className="nb-label">Next session</p>
                <p className="nb-title">Lobotomy 101</p>
                <p className="nb-meta">1 April 2026 · JHB Health Campus · 14:00 – 16:00</p>
              </div>
            </div>
            <div className="nb-right">
              <div className="nb-countdown">
                <p className="nb-count-val">18</p>
                <p className="nb-count-label">days</p>
              </div>
              <div className="nb-divider" />
              <div className="nb-countdown">
                <p className="nb-count-val">6</p>
                <p className="nb-count-label">hours</p>
              </div>
              <div className="nb-divider" />
              <button className="nb-btn">View session</button>
            </div>
          </div>

          {/* Upcoming classes */}
          <div className="s-header">
            <p className="s-title">Upcoming classes</p>
            <Link to="/courses" className="s-link">View all <ChevronRight /></Link>
          </div>
          <div className="classes-row">
            {CLASSES.map((c) => (
              <div className="class-card" key={c.title}>
                <span className="cc-date-badge"><CalendarDays />{c.date}</span>
                <p className="cc-title">{c.title}</p>
                <p className="cc-meta"><Clock />{c.time}</p>
                <p className="cc-meta" style={{ marginTop: -4 }}>{c.location}</p>
              </div>
            ))}
          </div>

          {/* Bottom: grades + notifications */}
          <div className="bottom-grid">

            {/* Grades */}
            <div className="grades-card">
              <div className="s-header" style={{ marginBottom: 18 }}>
                <p className="s-title">Grades</p>
                <Link to="/grades" className="s-link">Details <ChevronRight /></Link>
              </div>
              {GRADES.map((g) => (
                <div className="grade-row" key={g.name}>
                  <div className="grade-top">
                    <span className="grade-name">{g.name}</span>
                    <span className="grade-pct">{g.pct}%</span>
                  </div>
                  <div className="grade-bar-bg">
                    <div className={`grade-bar-fill ${gradeClass(g.pct)}`} style={{ width: `${g.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Notifications */}
            <div className="notif-card">
              <div className="s-header" style={{ marginBottom: 6 }}>
                <p className="s-title">Notifications</p>
                <Link to="/notifications" className="s-link">All <ChevronRight /></Link>
              </div>
              {NOTIFICATIONS.map((n, i) => (
                <div className="notif-item" key={i}>
                  <div className={`notif-dot-wrap ${n.type}`}><NotifIcon type={n.type} /></div>
                  <div>
                    <p className="notif-text">{n.text}</p>
                    <p className="notif-time">{n.time}</p>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </main>
      </div>
    </>
  );
}
