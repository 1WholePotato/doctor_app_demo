import { useEffect, useState } from "react";
import {
  CheckCircle, XCircle, Clock, User,
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

  .sg-header { margin-bottom: 24px; }
  .sg-header .eyebrow { font-size: 11px; font-weight: 600; color: var(--s-text-3); letter-spacing: .07em; text-transform: uppercase; margin-bottom: 5px; }
  .sg-header h1 { font-size: 28px; font-weight: 600; color: var(--s-text-1); letter-spacing: -.02em; }

  .sg-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 28px; }
  .sg-stat { background: var(--s-surface); border: 1px solid var(--s-border); border-radius: var(--s-radius); padding: 18px 20px; opacity: 0; animation: fadeUp .35s ease forwards; }
  .sg-stat:nth-child(1) { animation-delay: .05s; border-top: 2.5px solid var(--s-teal); }
  .sg-stat:nth-child(2) { animation-delay: .11s; border-top: 2.5px solid #F59E0B; }
  .sg-stat:nth-child(3) { animation-delay: .17s; border-top: 2.5px solid #EF4444; }
  .sg-stat-label { font-size: 10px; font-weight: 600; color: var(--s-text-3); letter-spacing: .07em; text-transform: uppercase; margin-bottom: 8px; }
  .sg-stat-val { font-size: 28px; font-weight: 600; color: var(--s-text-1); line-height: 1; }

  .s-title { font-size: 12px; font-weight: 700; color: var(--s-text-2); letter-spacing: .07em; text-transform: uppercase; margin-bottom: 14px; }

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
  .sg-card-meta { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--s-text-3); margin-top: 4px; }
  .sg-card-meta svg { width: 13px; height: 13px; }
  .sg-card-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 12px; border-top: 1px solid var(--s-border); }

  .status-badge { display: inline-flex; align-items: center; gap: 5px; padding: 4px 11px; border-radius: 20px; font-size: 11px; font-weight: 600; }
  .status-pending { background: #FFFBEB; color: #D97706; }
  .status-passed { background: var(--s-teal-soft); color: var(--s-teal-mid); }
  .status-failed { background: #FEE9E9; color: #DC2626; }
  .status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

  .sg-loading { font-size: 14px; color: var(--s-text-3); padding: 40px 0; }
  .sg-error { font-size: 13px; color: #DC2626; margin-bottom: 16px; }

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

export default function StudentGrades() {
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

  const passed = courses.filter((e) => e.status === "passed").length;
  const pending = courses.filter((e) => e.status === "pending").length;
  const failed = courses.filter((e) => e.status === "failed").length;

  return (
    <>
      <style>{styles}</style>
      <div className="sg-shell">
        <StudentSidebar prefix="sl" />

        <main className="sg-main">
          <div className="sg-header">
            <p className="eyebrow">Academic record</p>
            <h1>My grades</h1>
          </div>

          {loadError && <p className="sg-error">{loadError}</p>}

          {loading ? (
            <p className="sg-loading">Loading grades…</p>
          ) : (
            <>
              <div className="sg-stats">
                <div className="sg-stat">
                  <p className="sg-stat-label">Passed</p>
                  <p className="sg-stat-val">{passed}</p>
                </div>
                <div className="sg-stat">
                  <p className="sg-stat-label">Pending</p>
                  <p className="sg-stat-val">{pending}</p>
                </div>
                <div className="sg-stat">
                  <p className="sg-stat-label">Failed</p>
                  <p className="sg-stat-val">{failed}</p>
                </div>
              </div>

              <p className="s-title">All courses</p>
              {courses.length === 0 ? (
                <div className="sg-loading">No enrolled courses yet.</div>
              ) : (
                <div className="sg-grid">
                  {courses.map((e) => (
                    <div className="sg-card" key={e.bookingId}>
                      <div className="sg-card-top">
                        <div>
                          <p className="sg-card-title">{e.title}</p>
                          <p className="sg-card-meta">
                            <User />{e.instructor}
                          </p>
                        </div>
                        <StatusBadge status={e.status} />
                      </div>

                      <div className="sg-card-footer">
                        <span style={{ fontSize: 11, color: "var(--s-text-3)", background: "var(--s-bg)", border: "1px solid var(--s-border)", padding: "2px 9px", borderRadius: 20, fontWeight: 500 }}>
                          {e.paymentStatus}
                        </span>
                        {e.status === "passed" && (
                          <span style={{ fontSize: 12, color: "var(--s-teal-mid)", fontWeight: 500 }}>
                            <CheckCircle style={{ width: 13, height: 13, verticalAlign: "middle", marginRight: 4 }} />
                            Complete
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
}
