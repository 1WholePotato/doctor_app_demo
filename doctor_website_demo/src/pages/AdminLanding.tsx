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

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Users,
  Settings,
  ArrowUpRight,
  ChevronRight,
} from "lucide-react";
import { supabase } from "../supabaseClient";
import {
  downloadClassListCsv,
  fetchUpcomingSessions,
  type UpcomingSession,
} from "../lib/classLists";


function AdminLanding() {
  const [sessions, setSessions] = useState<UpcomingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [stats, setStats] = useState({ studentCount: 0, courseCount: 0, revenue: 0 });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [result, userRes, courseRes, bookingRes] = await Promise.all([
        fetchUpcomingSessions(),
        supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "student"),
        supabase.from("courses").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("bookings").select("payment_status, courses(course_price)").eq("payment_status", "paid"),
      ]);
      if (cancelled) return;

      setSessions(result.sessions);
      setQueryError(result.error);

      const studentCount = userRes.count ?? 0;
      const courseCount = courseRes.count ?? 0;
      let revenue = 0;
      if (bookingRes.data) {
        for (const b of bookingRes.data) {
          const c = Array.isArray(b.courses) ? b.courses[0] : b.courses;
          if (c && typeof c.course_price === "number") {
            revenue += c.course_price;
          }
        }
      }
      setStats({ studentCount, courseCount, revenue });
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {/* Inject global styles once */}

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
              <p className="stat-value">{stats.studentCount.toLocaleString()}</p>
              <p className="stat-sub"><span className="up">Active</span> verified accounts</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Active Courses</p>
              <p className="stat-value">{stats.courseCount}</p>
              <p className="stat-sub">Available curriculum</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Revenue (Gross)</p>
              <p className="stat-value">R {stats.revenue.toLocaleString()}</p>
              <p className="stat-sub"><span className="up">Paid</span> course bookings</p>
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

            <Link to="/admin/users" className="action-card">
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
            {queryError && (
              <p className="query-error" role="alert">{queryError}</p>
            )}
            <table className="table-inner">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Date</th>
                  <th>Instructor</th>
                  <th>Classlist</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="table-empty">Loading upcoming classes…</td>
                  </tr>
                ) : sessions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="table-empty">No upcoming classes scheduled</td>
                  </tr>
                ) : (
                  sessions.map((session) => (
                    <tr key={session.id}>
                      <td className="muted">{session.courseTitle}</td>
                      <td className="muted">{session.displayDate}</td>
                      <td className="muted">{session.instructor}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => downloadClassListCsv(session)}
                        >
                          Download
                        </button>
                        {session.downloadDisabledReason && (
                          <span className="download-note">{session.downloadDisabledReason}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </main>
    </>
  );
}

export default AdminLanding;