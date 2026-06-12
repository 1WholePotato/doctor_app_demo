/**
 * StudentCourses.tsx — Production-grade Student Courses Page
 *
 * Matches the navy/teal student design system from StudentLanding.
 * Same sidebar, same tokens, same font (Plus Jakarta Sans).
 *
 * CHANGES FROM ORIGINAL:
 * 1. Full shell — navy sidebar identical to StudentLanding.
 * 2. Course cards redesigned — teal left-border accent, seats badge with
 *    colour coding (green/amber/red), next session date chip, description clamp.
 * 3. Search bar — filters courses by title client-side. No extra packages.
 * 4. Seats badge — green (>5), amber (2–5), red (≤1) so urgency is visible.
 * 5. "Enrol" CTA on each card navigates to the course detail page.
 * 6. Staggered fade-up animation on cards.
 *
 * NPM: lucide-react (already installed)
 */

import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen, LayoutDashboard, Settings, LogOut,
  Bell, GraduationCap, CalendarDays, Clock, Search, Users,
} from "lucide-react";

// ─── Styles (same token system as StudentLanding) ─────────────────────────────

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

  .sc-shell * { box-sizing: border-box; margin: 0; padding: 0; }
  .sc-shell { font-family: var(--s-font); background: var(--s-bg); min-height: 100vh; display: flex; }

  /* ── Sidebar (identical to StudentLanding) ── */
  .sl-sidebar { width: 224px; min-height: 100vh; background: var(--s-navy); display: flex; flex-direction: column; padding: 26px 14px; position: fixed; top: 0; left: 0; bottom: 0; z-index: 10; }
  .sl-logo { display: flex; align-items: center; gap: 10px; padding: 0 8px; margin-bottom: 32px; }
  .sl-logo-mark { width: 30px; height: 30px; border-radius: 8px; background: var(--s-teal); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .sl-logo-mark svg { width: 16px; height: 16px; color: #fff; }
  .sl-logo-text { font-size: 14px; font-weight: 600; color: #fff; letter-spacing: -.01em; line-height: 1.2; }
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

  /* ── Main ── */
  .sc-main { margin-left: 224px; flex: 1; padding: 32px 40px; }

  /* ── Header ── */
  .sc-header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 24px; }
  .sc-header-left .eyebrow { font-size: 11px; font-weight: 600; color: var(--s-text-3); letter-spacing: .07em; text-transform: uppercase; margin-bottom: 5px; }
  .sc-header-left h1 { font-size: 28px; font-weight: 600; color: var(--s-text-1); letter-spacing: -.02em; }

  /* ── Search ── */
  .search-wrap { position: relative; width: 260px; }
  .search-wrap svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 15px; height: 15px; color: var(--s-text-3); pointer-events: none; }
  .search-input { width: 100%; border: 1px solid var(--s-border); border-radius: 10px; padding: 10px 14px 10px 36px; font-family: var(--s-font); font-size: 13px; color: var(--s-text-1); background: var(--s-surface); outline: none; transition: border-color .15s; }
  .search-input:focus { border-color: var(--s-teal); }
  .search-input::placeholder { color: var(--s-text-3); }

  /* ── Course grid ── */
  .sc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }

  .sc-card {
    background: var(--s-surface); border: 1px solid var(--s-border); border-radius: var(--s-radius);
    border-left: 3px solid var(--s-teal);
    padding: 20px 20px 16px; display: flex; flex-direction: column; gap: 10px;
    opacity: 0; animation: fadeUp .35s ease forwards;
    transition: transform .15s, box-shadow .15s;
  }
  .sc-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(15,30,53,.08); }
  .sc-card:nth-child(1) { animation-delay: .05s }
  .sc-card:nth-child(2) { animation-delay: .11s }
  .sc-card:nth-child(3) { animation-delay: .17s }
  .sc-card:nth-child(4) { animation-delay: .23s }
  .sc-card:nth-child(5) { animation-delay: .29s }

  .sc-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
  .sc-card-title { font-size: 15px; font-weight: 600; color: var(--s-text-1); line-height: 1.35; }
  .sc-card-desc { font-size: 13px; color: var(--s-text-2); line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

  .sc-meta-row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
  .sc-meta { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--s-text-3); }
  .sc-meta svg { width: 13px; height: 13px; }

  /* Seats badge */
  .seats-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 20px; font-size: 11px; font-weight: 600; }
  .seats-ok   { background: var(--s-teal-soft); color: var(--s-teal-mid); }
  .seats-low  { background: #FFFBEB; color: #D97706; }
  .seats-full { background: #FEE9E9; color: #DC2626; }
  .seats-dot  { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }

  .sc-card-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 4px; }
  .sc-enrol-btn { background: var(--s-teal); color: #fff; border: none; padding: 9px 18px; border-radius: 8px; font-family: var(--s-font); font-size: 13px; font-weight: 500; cursor: pointer; transition: background .15s; }
  .sc-enrol-btn:hover { background: var(--s-teal-mid); }

  /* ── Empty state ── */
  .sc-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 20px; text-align: center; }
  .sc-empty-icon { width: 52px; height: 52px; background: var(--s-teal-soft); border-radius: 14px; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }
  .sc-empty-icon svg { width: 24px; height: 24px; color: var(--s-teal); }
  .sc-empty-title { font-size: 18px; font-weight: 600; color: var(--s-text-1); margin-bottom: 6px; }
  .sc-empty-sub { font-size: 13px; color: var(--s-text-3); }

  @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
`;

// ─── Data ─────────────────────────────────────────────────────────────────────

interface Course {
  id: number;
  title: string;
  description: string;
  nextDate: string;
  duration: string;
  seatsLeft: number;
  totalSeats: number;
  category: string;
}

const COURSES: Course[] = [
  { id: 1, title: "CPR Training",             description: "Learn life-saving CPR techniques used in cardiac emergencies, including chest compressions and AED operation.", nextDate: "10 Apr 2026", duration: "3 hrs", seatsLeft: 6,  totalSeats: 20, category: "Emergency" },
  { id: 2, title: "First Aid Crash Course",   description: "Essential emergency response skills covering wound care, fractures, burns, and triage protocols.",              nextDate: "15 Apr 2026", duration: "3 hrs", seatsLeft: 2,  totalSeats: 18, category: "Emergency" },
  { id: 3, title: "Advanced Anatomy",         description: "Deep dive into musculoskeletal systems and organ placement with clinical correlations for practice.",           nextDate: "22 Apr 2026", duration: "4 hrs", seatsLeft: 10, totalSeats: 20, category: "Anatomy"   },
  { id: 4, title: "Clinical Pharmacology",    description: "Drug classes, mechanisms of action, and safe prescribing principles for common conditions.",                    nextDate: "28 Apr 2026", duration: "4 hrs", seatsLeft: 1,  totalSeats: 15, category: "Pharmacology" },
  { id: 5, title: "Diagnostic Imaging",       description: "Reading X-rays, CT scans, and MRIs with confidence. Covers the most common presentations in clinical practice.", nextDate: "5 May 2026",  duration: "5 hrs", seatsLeft: 8,  totalSeats: 18, category: "Diagnostics" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SeatsBadge({ seats }: { seats: number }) {
  const cls = seats <= 1 ? "seats-full" : seats <= 4 ? "seats-low" : "seats-ok";
  const label = seats === 0 ? "Full" : seats === 1 ? "1 seat left" : `${seats} seats left`;
  return <span className={`seats-badge ${cls}`}><span className="seats-dot" />{label}</span>;
}

function NavItem({ to, icon: Icon, label, active }: { to: string; icon: React.ElementType; label: string; active: boolean }) {
  return (
    <Link to={to} className={`sl-nav-item${active ? " active" : ""}`}>
      <Icon />{label}
    </Link>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StudentCourses() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const filtered = COURSES.filter((c) =>
    c.title.toLowerCase().includes(query.toLowerCase()) ||
    c.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <style>{styles}</style>
      <div className="sc-shell">

        {/* ── Sidebar ── */}
        <aside className="sl-sidebar">
          <div className="sl-logo">
            <div className="sl-logo-mark"><BookOpen /></div>
            <div className="sl-logo-text">MedLearn<span>Student Portal</span></div>
          </div>
          <nav className="sl-nav">
            <p className="sl-nav-label">Menu</p>
            <NavItem to="/studentlanding" icon={LayoutDashboard} label="Dashboard"    active={pathname === "/studentlanding"} />
            <NavItem to="/courses"        icon={BookOpen}        label="My Courses"   active={pathname.startsWith("/courses")} />
            <NavItem to="/grades"         icon={GraduationCap}   label="Grades"       active={pathname.startsWith("/grades")} />
            <NavItem to="/notifications"  icon={Bell}            label="Notifications" active={pathname.startsWith("/notifications")} />
            <p className="sl-nav-label">Account</p>
            <NavItem to="/settings"       icon={Settings}        label="Settings"     active={pathname.startsWith("/settings")} />
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

        {/* ── Main ── */}
        <main className="sc-main">
          <div className="sc-header">
            <div className="sc-header-left">
              <p className="eyebrow">Browse</p>
              <h1>Available courses</h1>
            </div>
            <div className="search-wrap">
              <Search />
              <input
                className="search-input"
                type="text"
                placeholder="Search courses…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="sc-empty">
              <div className="sc-empty-icon"><BookOpen /></div>
              <p className="sc-empty-title">No courses found</p>
              <p className="sc-empty-sub">Try a different search term.</p>
            </div>
          ) : (
            <div className="sc-grid">
              {filtered.map((course) => (
                <div key={course.id} className="sc-card">
                  <div className="sc-card-top">
                    <h2 className="sc-card-title">{course.title}</h2>
                    <SeatsBadge seats={course.seatsLeft} />
                  </div>

                  <p className="sc-card-desc">{course.description}</p>

                  <div className="sc-meta-row">
                    <span className="sc-meta"><CalendarDays />{course.nextDate}</span>
                    <span className="sc-meta"><Clock />{course.duration}</span>
                    <span className="sc-meta"><Users />{course.totalSeats} capacity</span>
                  </div>

                  <div className="sc-card-footer">
                    <span style={{ fontSize: 11, color: "var(--s-text-3)", background: "var(--s-bg)", border: "1px solid var(--s-border)", padding: "2px 9px", borderRadius: 20, fontWeight: 500 }}>
                      {course.category}
                    </span>
                    <button className="sc-enrol-btn" onClick={() => navigate(`/courses/${course.id}`, { state: { course } })}>
                      View course
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
