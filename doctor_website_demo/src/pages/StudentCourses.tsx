import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen, Search, User, CheckCircle, XCircle, Clock,
} from "lucide-react";
import StudentSidebar from "../components/StudentSidebar";
import { getSessionUser } from "../lib/auth";
import { fetchStudentCourses, type CourseStatus, type StudentCourseRow } from "../lib/studentCourses";

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

  .sc-main { margin-left: 224px; flex: 1; padding: 32px 40px; }

  .sc-header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 24px; }
  .sc-header-left .eyebrow { font-size: 11px; font-weight: 600; color: var(--s-text-3); letter-spacing: .07em; text-transform: uppercase; margin-bottom: 5px; }
  .sc-header-left h1 { font-size: 28px; font-weight: 600; color: var(--s-text-1); letter-spacing: -.02em; }

  .search-wrap { position: relative; width: 260px; }
  .search-wrap svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 15px; height: 15px; color: var(--s-text-3); pointer-events: none; }
  .search-input { width: 100%; border: 1px solid var(--s-border); border-radius: 10px; padding: 10px 14px 10px 36px; font-family: var(--s-font); font-size: 13px; color: var(--s-text-1); background: var(--s-surface); outline: none; transition: border-color .15s; }
  .search-input:focus { border-color: var(--s-teal); }
  .search-input::placeholder { color: var(--s-text-3); }

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

  .status-badge { display: inline-flex; align-items: center; gap: 5px; padding: 4px 11px; border-radius: 20px; font-size: 11px; font-weight: 600; }
  .status-pending { background: #FFFBEB; color: #D97706; }
  .status-passed { background: var(--s-teal-soft); color: var(--s-teal-mid); }
  .status-failed { background: #FEE9E9; color: #DC2626; }
  .status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

  .sc-card-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 4px; }
  .sc-enrol-btn { background: var(--s-teal); color: #fff; border: none; padding: 9px 18px; border-radius: 8px; font-family: var(--s-font); font-size: 13px; font-weight: 500; cursor: pointer; transition: background .15s; }
  .sc-enrol-btn:hover { background: var(--s-teal-mid); }

  .sc-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 20px; text-align: center; }
  .sc-empty-icon { width: 52px; height: 52px; background: var(--s-teal-soft); border-radius: 14px; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }
  .sc-empty-icon svg { width: 24px; height: 24px; color: var(--s-teal); }
  .sc-empty-title { font-size: 18px; font-weight: 600; color: var(--s-text-1); margin-bottom: 6px; }
  .sc-empty-sub { font-size: 13px; color: var(--s-text-3); }

  .sc-loading { font-size: 14px; color: var(--s-text-3); padding: 40px 0; }
  .sc-error { font-size: 13px; color: #DC2626; margin-bottom: 16px; }

  @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
`;

function StatusBadge({ status }: { status: CourseStatus }) {
  const map = {
    pending: { label: "Pending", cls: "status-pending", Icon: Clock },
    passed: { label: "Passed", cls: "status-passed", Icon: CheckCircle },
    failed: { label: "Failed", cls: "status-failed", Icon: XCircle },
  };
  const { label, cls } = map[status];
  return (
    <span className={`status-badge ${cls}`}>
      <span className="status-dot" />{label}
    </span>
  );
}

export default function StudentCourses() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [courses, setCourses] = useState<StudentCourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const user = await getSessionUser();
      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }

      const result = await fetchStudentCourses(user.id);
      if (cancelled) return;

      if (result.error) {
        setLoadError(result.error);
      } else {
        setLoadError("");
        setCourses(result.courses);
      }
      setLoading(false);
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  const filtered = courses.filter((c) =>
    c.title.toLowerCase().includes(query.toLowerCase()) ||
    c.instructor.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <>
      <style>{styles}</style>
      <div className="sc-shell">
        <StudentSidebar prefix="sl" />

        <main className="sc-main">
          <div className="sc-header">
            <div className="sc-header-left">
              <p className="eyebrow">Enrolments</p>
              <h1>My courses</h1>
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

          {loadError && <p className="sc-error">{loadError}</p>}

          {loading ? (
            <p className="sc-loading">Loading courses…</p>
          ) : filtered.length === 0 ? (
            <div className="sc-empty">
              <div className="sc-empty-icon"><BookOpen /></div>
              <p className="sc-empty-title">No courses found</p>
              <p className="sc-empty-sub">
                {query ? "Try a different search term." : "You are not enrolled in any courses yet."}
              </p>
            </div>
          ) : (
            <div className="sc-grid">
              {filtered.map((course) => (
                <div key={course.bookingId} className="sc-card">
                  <div className="sc-card-top">
                    <h2 className="sc-card-title">{course.title}</h2>
                    <StatusBadge status={course.status} />
                  </div>

                  <p className="sc-card-desc">{course.description || "No description provided."}</p>

                  <div className="sc-meta-row">
                    <span className="sc-meta"><User />{course.instructor}</span>
                    <span className="sc-meta">R {course.price.toLocaleString()}</span>
                  </div>

                  <div className="sc-card-footer">
                    <span style={{ fontSize: 11, color: "var(--s-text-3)", background: "var(--s-bg)", border: "1px solid var(--s-border)", padding: "2px 9px", borderRadius: 20, fontWeight: 500 }}>
                      {course.paymentStatus}
                    </span>
                    <button
                      className="sc-enrol-btn"
                      onClick={() => navigate(`/courses/${course.courseId}`, { state: { course } })}
                    >
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
