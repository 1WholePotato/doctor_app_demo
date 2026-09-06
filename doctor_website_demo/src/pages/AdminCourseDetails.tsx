import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Plus,
  X,
  AlertCircle,
  User,
  ChevronLeft,
} from "lucide-react";
import { supabase } from "../supabaseClient";
import AdminSidebar from "../components/AdminSidebar";
import { instructorName, type Instructor } from "../lib/instructors";
import { fetchInstructorsForCourse, grantInstructorCourse } from "../lib/instructorCourses";
import { firstLocationId } from "../lib/locations";

const globalStyles = `
  :root {
    --bg:        #F7F6F3;
    --surface:   #FFFFFF;
    --sidebar:   #111110;
    --gold:      #C9A84C;
    --gold-soft: #F5EDD6;
    --text-1:    #111110;
    --text-2:    #6B6A66;
    --text-3:    #A09F9A;
    --border:    #E8E6E1;
    --radius:    14px;
    --font-display: 'Fraunces', Georgia, serif;
    --font-body:    'DM Sans', system-ui, sans-serif;
  }

  .acd-shell * { box-sizing: border-box; margin: 0; padding: 0; }
  .acd-shell { font-family: var(--font-body); background: var(--bg); min-height: 100vh; display: flex; }

  .sidebar { width: 228px; min-height: 100vh; background: var(--sidebar); display: flex; flex-direction: column; padding: 28px 16px; position: fixed; top: 0; left: 0; bottom: 0; z-index: 10; }
  .sidebar-logo { font-family: var(--font-display); font-size: 18px; font-weight: 300; color: #fff; letter-spacing: .02em; padding: 0 8px; margin-bottom: 36px; display: flex; align-items: center; gap: 10px; }
  .sidebar-logo span { color: var(--gold); }
  .sidebar-nav { display: flex; flex-direction: column; gap: 2px; flex: 1; }
  .nav-item { display: flex; align-items: center; gap: 11px; padding: 10px 12px; border-radius: 10px; color: #888887; font-size: 14px; font-weight: 400; text-decoration: none; transition: background .15s, color .15s; cursor: pointer; border: none; background: none; width: 100%; text-align: left; }
  .nav-item:hover { background: rgba(255,255,255,.07); color: #fff; }
  .nav-item.active { background: rgba(201,168,76,.15); color: var(--gold); }
  .nav-item svg { width: 18px; height: 18px; flex-shrink: 0; }
  .nav-section-label { font-size: 10px; font-weight: 500; letter-spacing: .1em; color: #444443; text-transform: uppercase; padding: 0 12px; margin: 20px 0 6px; }
  .sidebar-footer { margin-top: auto; padding-top: 20px; border-top: 1px solid #222221; }

  .acd-main { margin-left: 228px; flex: 1; padding: 40px 44px; max-width: 1000px; }

  .back-link { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-3); text-decoration: none; margin-bottom: 24px; transition: color .15s; }
  .back-link:hover { color: var(--text-1); }
  .back-link svg { width: 15px; height: 15px; }

  .course-hero {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    border-left: 3px solid var(--gold); padding: 28px 32px;
    display: flex; align-items: flex-start; justify-content: space-between; gap: 24px;
    margin-bottom: 32px;
    opacity: 0; animation: fadeUp .35s ease .05s forwards;
  }
  .hero-left { flex: 1; }
  .hero-eyebrow { font-size: 11px; font-weight: 500; color: var(--text-3); letter-spacing: .08em; text-transform: uppercase; margin-bottom: 8px; }
  .hero-title { font-family: var(--font-display); font-size: 28px; font-weight: 300; color: var(--text-1); line-height: 1.3; margin-bottom: 10px; }
  .hero-desc { font-size: 14px; color: var(--text-2); line-height: 1.7; max-width: 520px; }
  .hero-right { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; flex-shrink: 0; }
  .hero-price { font-family: var(--font-display); font-size: 30px; font-weight: 300; color: var(--text-1); }
  .hero-price-label { font-size: 11px; color: var(--text-3); text-align: right; }

  .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  .section-title { font-size: 13px; font-weight: 500; color: var(--text-2); letter-spacing: .06em; text-transform: uppercase; }
  .btn-primary { display: flex; align-items: center; gap: 7px; background: var(--text-1); color: #fff; border: none; padding: 10px 18px; border-radius: 10px; font-family: var(--font-body); font-size: 13px; font-weight: 500; cursor: pointer; transition: background .15s, transform .1s; }
  .btn-primary:hover { background: #2a2a28; transform: translateY(-1px); }
  .btn-primary svg { width: 15px; height: 15px; }

  .sessions-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    overflow: hidden;
    opacity: 0; animation: fadeUp .35s ease .15s forwards;
  }
  .sessions-table { width: 100%; border-collapse: collapse; }
  .sessions-table thead th { padding: 13px 20px; font-size: 11px; font-weight: 500; letter-spacing: .08em; text-transform: uppercase; color: var(--text-3); border-bottom: 1px solid var(--border); text-align: left; background: #FAFAF8; }
  .sessions-table tbody tr { border-bottom: 1px solid var(--border); transition: background .12s; }
  .sessions-table tbody tr:last-child { border-bottom: none; }
  .sessions-table tbody tr:hover { background: #FAFAF8; }
  .sessions-table tbody td { padding: 15px 20px; font-size: 14px; color: var(--text-1); }
  .sessions-table tbody td.muted { color: var(--text-2); }

  .cell-with-icon { display: flex; align-items: center; gap: 8px; }
  .cell-with-icon svg { width: 14px; height: 14px; color: var(--text-3); flex-shrink: 0; }

  .status-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
  .status-active { background: #EAF5EE; color: #2E7D52; }
  .status-inactive { background: #FEE9E9; color: #A12D2D; }
  .status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

  .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; text-align: center; }
  .empty-icon { width: 52px; height: 52px; background: var(--gold-soft); border-radius: 14px; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }
  .empty-icon svg { width: 24px; height: 24px; color: var(--gold); }
  .empty-title { font-family: var(--font-display); font-size: 18px; font-weight: 300; color: var(--text-1); margin-bottom: 6px; }
  .empty-sub { font-size: 13px; color: var(--text-3); max-width: 240px; line-height: 1.6; }

  .load-error { font-size: 13px; color: #C0392B; margin-bottom: 16px; display: flex; align-items: center; gap: 6px; }
  .load-error svg { width: 14px; height: 14px; }
  .acd-loading { font-size: 14px; color: var(--text-3); padding: 40px 0; }

  .modal-overlay { position: fixed; inset: 0; background: rgba(17,17,16,.45); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; animation: fadeIn .15s ease; }
  .modal { background: var(--surface); border-radius: 18px; width: 100%; max-width: 460px; padding: 32px; position: relative; animation: slideUp .2s ease; }
  .modal-close { position: absolute; top: 20px; right: 20px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-2); transition: background .12s; }
  .modal-close:hover { background: var(--border); }
  .modal-close svg { width: 16px; height: 16px; }
  .modal-eyebrow { font-size: 11px; font-weight: 500; color: var(--text-3); letter-spacing: .08em; text-transform: uppercase; margin-bottom: 6px; }
  .modal h2 { font-family: var(--font-display); font-size: 24px; font-weight: 300; color: var(--text-1); margin-bottom: 26px; }

  .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
  .field label { font-size: 12px; font-weight: 500; color: var(--text-2); letter-spacing: .04em; text-transform: uppercase; }
  .field select { width: 100%; border: 1px solid var(--border); border-radius: 10px; padding: 11px 14px; font-family: var(--font-body); font-size: 14px; color: var(--text-1); background: #FAFAF8; outline: none; transition: border-color .15s; appearance: none; }
  .field select:focus { border-color: var(--gold); background: #fff; }
  .field-error { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #C0392B; }
  .field-error svg { width: 13px; height: 13px; }
  .btn-submit { width: 100%; background: var(--text-1); color: #fff; border: none; padding: 13px; border-radius: 10px; font-family: var(--font-body); font-size: 14px; font-weight: 500; cursor: pointer; transition: background .15s; margin-top: 6px; }
  .btn-submit:hover { background: #2a2a28; }

  @keyframes fadeUp  { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
`;

interface CourseDetail {
  id: string;
  title: string;
  description: string;
  price: number;
}

interface SessionRow {
  id: string;
  instructorName: string;
  active: boolean;
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span className={`status-badge ${active ? "status-active" : "status-inactive"}`}>
      <span className="status-dot" />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function AddSessionModal({
  onClose,
  onAdd,
  instructors,
}: {
  onClose: () => void;
  onAdd: (instructorId: string) => void;
  instructors: Instructor[];
}) {
  const [instructorId, setInstructorId] = useState(instructors[0]?.id ?? "");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!instructorId) {
      setError("Select a teacher");
      return;
    }
    onAdd(instructorId);
    onClose();
  };

  const stopProp = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={stopProp} role="dialog" aria-modal="true" aria-labelledby="session-modal-title">
        <button className="modal-close" onClick={onClose} aria-label="Close"><X /></button>

        <p className="modal-eyebrow">Schedule</p>
        <h2 id="session-modal-title">Add a class session</h2>

        <div className="field">
          <label htmlFor="s-inst">Teacher</label>
          <select
            id="s-inst"
            value={instructorId}
            onChange={(e) => { setInstructorId(e.target.value); setError(""); }}
          >
            {instructors.length === 0 && <option value="">No teachers in database</option>}
            {instructors.map((instructor) => (
              <option key={instructor.id} value={instructor.id}>
                {instructorName(instructor)}
              </option>
            ))}
          </select>
          {error && <span className="field-error"><AlertCircle />{error}</span>}
        </div>

        <button className="btn-submit" onClick={handleSubmit}>Add session</button>
      </div>
    </div>
  );
}

export default function AdminCourseDetails() {
  const { id } = useParams<{ id: string }>();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!id) {
      setLoadError("Missing course id");
      setLoading(false);
      return;
    }

    setLoading(true);

    const [courseResult, sessionResult, instructorResult] = await Promise.all([
      supabase
        .from("courses")
        .select("id, course_title, course_description, course_price")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("course_sessions")
        .select("id, active, instructors ( first_name, last_name, email )")
        .eq("course_id", id),
      fetchInstructorsForCourse(id),
    ]);

    setInstructors(instructorResult.instructors);

    if (courseResult.error) {
      setLoadError(courseResult.error.message);
      setLoading(false);
      return;
    }

    if (!courseResult.data) {
      setLoadError("Course not found");
      setLoading(false);
      return;
    }

    if (sessionResult.error) {
      setLoadError(sessionResult.error.message);
    } else {
      setLoadError(instructorResult.error ?? "");
    }

    setCourse({
      id: courseResult.data.id,
      title: courseResult.data.course_title,
      description: courseResult.data.course_description ?? "",
      price: courseResult.data.course_price,
    });

    setSessions(
      (sessionResult.data ?? []).map((row) => {
        const instructor = Array.isArray(row.instructors) ? row.instructors[0] : row.instructors;
        return {
          id: row.id,
          instructorName: instructor ? instructorName(instructor) : "Unassigned",
          active: row.active,
        };
      }),
    );

    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, [id]);

  const handleAdd = async (instructorId: string) => {
    if (!id) return;

    const locationId = await firstLocationId();
    if (!locationId) {
      alert("Add a location in the database before assigning a teacher.");
      return;
    }

    const { error } = await supabase.from("course_sessions").insert({
      course_id: id,
      instructor_id: instructorId,
      location_id: locationId,
      start_date: new Date().toISOString().slice(0, 10),
      end_date: new Date().toISOString().slice(0, 10),
      start_time: "09:00:00",
      end_time: "12:00:00",
      max_students: 20,
      active: true,
    });

    if (error) {
      alert(error.message);
      return;
    }

    const grantError = await grantInstructorCourse(instructorId, id);
    if (grantError) alert(grantError);

    await loadData();
  };

  if (loading) {
    return (
      <>
        <style>{globalStyles}</style>
        <div className="acd-shell">
          <AdminSidebar />
          <main className="acd-main">
            <p className="acd-loading">Loading course…</p>
          </main>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{globalStyles}</style>

      <div className="acd-shell">
        <AdminSidebar />

        <main className="acd-main">
          <Link to="/admincourses" className="back-link"><ChevronLeft />Back to courses</Link>

          {loadError && (
            <p className="load-error"><AlertCircle />{loadError}</p>
          )}

          {course && (
            <div className="course-hero">
              <div className="hero-left">
                <p className="hero-eyebrow">Course detail</p>
                <h1 className="hero-title">{course.title}</h1>
                <p className="hero-desc">{course.description}</p>
              </div>
              <div className="hero-right">
                <p className="hero-price-label">Course price</p>
                <p className="hero-price">R {course.price.toLocaleString()}</p>
              </div>
            </div>
          )}

          <div className="section-header">
            <p className="section-title">Class sessions</p>
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              <Plus />Add session
            </button>
          </div>

          <div className="sessions-card">
            {sessions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><User /></div>
                <p className="empty-title">No sessions yet</p>
                <p className="empty-sub">Add a teacher assignment for this course.</p>
              </div>
            ) : (
              <table className="sessions-table">
                <thead>
                  <tr>
                    <th>Teacher</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id}>
                      <td className="muted">
                        <div className="cell-with-icon">
                          <User />
                          {s.instructorName}
                        </div>
                      </td>
                      <td><ActiveBadge active={s.active} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>

      {showModal && (
        <AddSessionModal
          onClose={() => setShowModal(false)}
          onAdd={handleAdd}
          instructors={instructors}
        />
      )}
    </>
  );
}
