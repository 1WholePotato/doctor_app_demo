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

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSessionUser } from "../lib/auth";
import { fetchStudentCourses, type StudentCourseRow } from "../lib/studentCourses";
import {
  BookOpen, CalendarDays, ChevronRight, Clock, Bell,
} from "lucide-react";


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

// ─── Notification icon ────────────────────────────────────────────────────────

function NotifIcon({ type }: { type: string }) {
  if (type === "success") return <BookOpen />;
  if (type === "warn")    return <Clock />;
  return <Bell />;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StudentLanding() {
  const [userName, setUserName] = useState("Student");
  const [enrolledCourses, setEnrolledCourses] = useState<StudentCourseRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const user = await getSessionUser();
      if (!user) {
        return;
        return;
      }
      if (!cancelled) {
        setUserName(user.first_name || user.email?.split("@")[0] || "Student");
      }
      const res = await fetchStudentCourses(user.id);
      if (!cancelled) {
        setEnrolledCourses(res.courses);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  return (
    <>
        {/* ── Main ── */}
        <main className="sl-main">

          {/* Header */}
          <div className="sl-header">
            <p className="eyebrow">Student dashboard</p>
            <h1>Welcome back, <span>{userName}.</span></h1>
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
            {enrolledCourses.length > 0 ? enrolledCourses.slice(0, 3).map((c) => (
              <div className="class-card" key={c.bookingId}>
                <span className="cc-date-badge"><CalendarDays />Enrolled</span>
                <p className="cc-title">{c.title}</p>
                <p className="cc-meta"><Clock />R {c.price.toLocaleString()}</p>
                <p className="cc-meta" style={{ marginTop: -4 }}>{c.instructor}</p>
              </div>
            )) : CLASSES.map((c) => (
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
    </>
  );
}
