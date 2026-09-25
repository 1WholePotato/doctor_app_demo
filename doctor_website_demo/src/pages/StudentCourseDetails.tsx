/**
 * StudentCourseDetails.tsx — Production-grade Student Course Detail Page
 *
 * CHANGES FROM ORIGINAL:
 * 1. Full shell — same navy/teal sidebar as StudentLanding & StudentCourses.
 * 2. Course hero — title, description, category, duration pulled from
 *    location.state (passed from StudentCourses) with a fallback.
 * 3. Sessions table — date, location, instructor, seats with colour-coded badge.
 *    Each row has a "Book now" button that disables after booking.
 * 4. Booking confirmation modal — redesigned with a teal success icon,
 *    summary of what was booked, and a clean close button.
 * 5. Back link → /courses
 * 6. Same CSS token system — no new packages.
 *
 * NPM: lucide-react (already installed)
 */

import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  CalendarDays, Clock,
  MapPin, User, ChevronLeft, Users,
} from "lucide-react";
import {
  fetchStudentCourseDetail,
  type StudentCourseDetail,
  type StudentSessionRow,
} from "../lib/studentCourses";


function SeatsBadge({ seats }: { seats: number }) {
  const cls   = seats <= 1 ? "seats-full" : seats <= 3 ? "seats-low" : "seats-ok";
  const label = seats === 0 ? "Full" : seats === 1 ? "1 seat left" : `${seats} seats left`;
  return <span className={`seats-badge ${cls}`}><span className="seats-dot" />{label}</span>;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StudentCourseDetails() {
  const { id } = useParams<{ id: string }>();
  const routerLocation = useLocation();
  const passedCourse = (routerLocation.state as { course?: { courseId?: string; title?: string; description?: string } })?.course;

  const [course, setCourse] = useState<StudentCourseDetail | null>(null);
  const [sessions, setSessions] = useState<StudentSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!id) {
      return;
    }

    let cancelled = false;

    async function load(resolvedId: string) {
      setLoading(true);
      const result = await fetchStudentCourseDetail(resolvedId);
      if (cancelled) return;

      if (result.error) {
        setLoadError(result.error);
        setCourse(null);
        setSessions([]);
      } else {
        setLoadError("");
        setCourse(result.course);
        setSessions(result.sessions);
      }
      setLoading(false);
    }

    void load(id);
    return () => { cancelled = true; };
  }, [id]);

  const displayCourse = course ?? (passedCourse && id ? {
    id,
    title: passedCourse.title ?? "Course",
    description: passedCourse.description ?? "",
    category: "Course",
    duration: "—",
    totalSeats: 0,
  } satisfies StudentCourseDetail : null);

  if (!id) {
    return (
      <>
        <main className="scd-main">
            <p className="scd-error">Missing course id.</p>
            <Link to="/courses" className="back-link"><ChevronLeft />Back to courses</Link>
          </main>
      </>
    );
  }

  return (
    <>
        {/* ── Main ── */}
        <main className="scd-main">
          <Link to="/courses" className="back-link"><ChevronLeft />Back to courses</Link>

          {loadError && <p className="scd-error">{loadError}</p>}
          {loading && <p className="scd-loading">Loading course…</p>}

          {displayCourse && (
          <>
          {/* Course hero */}
          <div className="hero">
            <div className="hero-left">
              <p className="eyebrow">{displayCourse.category}</p>
              <h1>{displayCourse.title}</h1>
              <p>{displayCourse.description || "No description provided."}</p>
            </div>
            <div className="hero-right">
              <span className="hero-cat">{displayCourse.category}</span>
              <span className="hero-meta"><Clock />Duration: {displayCourse.duration}</span>
              {displayCourse.totalSeats > 0 && (
                <span className="hero-meta"><Users />{displayCourse.totalSeats} seats per session</span>
              )}
            </div>
          </div>

          {/* Sessions */}
          <div className="s-header">
            <p className="s-title">Available sessions</p>
          </div>

          <div className="sessions-card">
            {sessions.length === 0 && !loading ? (
              <p className="scd-empty">No upcoming sessions for this course.</p>
            ) : (
            <table className="sessions-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Location</th>
                  <th>Instructor</th>
                  <th>Spaces</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                    <tr key={session.id}>
                      <td>
                        <div className="cell-icon"><CalendarDays />{session.date}</div>
                      </td>
                      <td className="muted">
                        <div className="cell-icon"><MapPin />{session.location}</div>
                      </td>
                      <td className="muted">
                        <div className="cell-icon"><User />{session.instructor}</div>
                      </td>
                      <td><SeatsBadge seats={session.seatsLeft} /></td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="book-btn"
                          type="button"
                          disabled
                          title="Online booking pending server RLS (issue #4)"
                          aria-label="Book now — online booking not yet available"
                        >
                          Book now
                        </button>
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
          </>
          )}
        </main>
    </>
  );
}
