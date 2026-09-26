import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  CalendarDays, Clock,
  MapPin, User, ChevronLeft,
} from "lucide-react";
import { Skeleton, TableRowSkeleton } from "../components/Skeleton";
import {
  fetchStudentCourseDetail,
  type StudentCourseDetail,
  type StudentSessionRow,
} from "../lib/studentCourses";


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

          {loading ? (
            <>
              <div className="hero">
                <div className="hero-left" style={{ width: "100%" }}>
                  <Skeleton width="100px" height={14} style={{ marginBottom: 10 }} />
                  <Skeleton width="50%" height={32} style={{ marginBottom: 12 }} />
                  <Skeleton width="80%" height={16} />
                </div>
              </div>
              <div className="s-header">
                <p className="s-title">Available sessions</p>
              </div>
              <div className="sessions-card">
                <table className="sessions-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Location</th>
                      <th>Instructor</th>
                      <th>Availability</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    <TableRowSkeleton cols={5} />
                    <TableRowSkeleton cols={5} />
                  </tbody>
                </table>
              </div>
            </>
          ) : displayCourse && (
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
                  <th>Availability</th>
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
                      <td className="muted" title="Bookings are not linked to a session, so remaining capacity cannot be calculated.">
                        Unavailable
                      </td>
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
