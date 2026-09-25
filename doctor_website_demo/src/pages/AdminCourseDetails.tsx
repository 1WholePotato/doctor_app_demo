import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Plus,
  X,
  AlertCircle,
  User,
  ChevronLeft,
} from "lucide-react";
import { supabase } from "../supabaseClient";
import { instructorName, type Instructor } from "../lib/instructors";
import { fetchInstructorsForCourse, grantInstructorCourse } from "../lib/instructorCourses";
import { firstLocationId } from "../lib/locations";
import { Skeleton, TableRowSkeleton } from "../components/Skeleton";

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

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
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!id) {
      setLoadError("Missing course id");
      setLoading(false);
      return;
    }

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
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      await loadData();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  const handleAdd = async (instructorId: string) => {
    if (!id) return;

    const locationId = await firstLocationId();
    if (!locationId) {
      setActionError("Add a location in the database before assigning a teacher.");
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
      setActionError(error.message);
      return;
    }

    const grantError = await grantInstructorCourse(instructorId, id);
    if (grantError) setActionError(grantError);

    await loadData();
  };

  if (loading) {
    return (
      <main className="acd-main">
        <Link to="/admincourses" className="back-link"><ChevronLeft />Back to courses</Link>
        <div className="course-hero">
          <div className="hero-left" style={{ width: "100%" }}>
            <Skeleton width="120px" height={14} style={{ marginBottom: 10 }} />
            <Skeleton width="60%" height={32} style={{ marginBottom: 12 }} />
            <Skeleton width="90%" height={16} />
          </div>
        </div>
        <div className="section-header" style={{ marginTop: 28 }}>
          <p className="section-title">Class sessions</p>
        </div>
        <div className="sessions-card">
          <table className="sessions-table">
            <thead>
              <tr>
                <th>Teacher</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <TableRowSkeleton cols={2} />
              <TableRowSkeleton cols={2} />
            </tbody>
          </table>
        </div>
      </main>
    );
  }

  return (
    <>

      <main className="acd-main">
          <Link to="/admincourses" className="back-link"><ChevronLeft />Back to courses</Link>

          {actionError && (
            <p className="load-error" style={{ marginBottom: 16 }}><AlertCircle />{actionError}</p>
          )}
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
