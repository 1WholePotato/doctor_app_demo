import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { fetchStudentCourses, type StudentCourseRow } from "../lib/studentCourses";
import { BookOpen, CalendarDays, ChevronRight, Clock, Bell } from "lucide-react";

export default function StudentLanding() {
  const { user } = useAuth();
  const userName = user?.first_name || user?.email?.split("@")[0] || "Student";
  const [courses, setCourses] = useState<StudentCourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!user) return;

    async function load() {
      if (!user) return;
      try {
        const result = await fetchStudentCourses(user.id);
        if (cancelled) return;
        setCourses(result.courses);
        setLoadError(result.error ?? "");
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Could not load your courses.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [user]);

  return (
    <main className="sl-main">
      <div className="sl-header">
        <p className="eyebrow">Student dashboard</p>
        <h1>Welcome back, <span>{userName}.</span></h1>
      </div>

      {loadError && <p className="sc-error" role="alert">{loadError}</p>}

      <div className="next-banner">
        <div className="nb-left">
          <div className="nb-icon"><CalendarDays /></div>
          <div>
            <p className="nb-label">Session schedule</p>
            <p className="nb-title">Personal session details unavailable</p>
            <p className="nb-meta">Course bookings are not linked to a specific session yet, so this dashboard cannot identify your next session.</p>
          </div>
        </div>
        <div className="nb-right">
          <Link to="/courses" className="nb-btn">Browse courses</Link>
        </div>
      </div>

      <div className="s-header">
        <p className="s-title">My courses</p>
        <Link to="/courses" className="s-link">View all <ChevronRight /></Link>
      </div>
      {loading ? (
        <p className="sc-empty-sub" role="status">Loading your courses…</p>
      ) : loadError && courses.length === 0 ? null : courses.length === 0 ? (
        <div className="sc-empty">
          <div className="sc-empty-icon"><BookOpen /></div>
          <p className="sc-empty-title">No enrolled courses yet</p>
          <p className="sc-empty-sub">Browse the course catalog to see what is available.</p>
          <Link to="/courses" className="s-link">Browse course catalog <ChevronRight /></Link>
        </div>
      ) : (
        <div className="classes-row">
          {courses.slice(0, 3).map((course) => (
            <Link
              to={`/courses/${course.courseId}`}
              state={{ course }}
              className="class-card"
              key={course.bookingId}
            >
              <span className="cc-date-badge"><BookOpen />Course booking</span>
              <p className="cc-title">{course.title}</p>
              <p className="cc-meta"><Clock />{course.instructor}</p>
            </Link>
          ))}
        </div>
      )}

      <div className="bottom-grid">
        <div className="grades-card">
          <div className="s-header" style={{ marginBottom: 18 }}>
            <p className="s-title">Academic results</p>
            <Link to="/grades" className="s-link">Details <ChevronRight /></Link>
          </div>
          <p className="sc-empty-sub">Grade records are not connected yet. Payment status does not confirm course completion.</p>
        </div>

        <div className="notif-card">
          <div className="s-header" style={{ marginBottom: 6 }}>
            <p className="s-title">Notifications</p>
            <Link to="/notifications" className="s-link">All <ChevronRight /></Link>
          </div>
          <div className="notif-item">
            <div className="notif-dot-wrap info"><Bell /></div>
            <div>
              <p className="notif-text">Notifications are not connected to saved records yet.</p>
              <p className="notif-time">No live notification data</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
