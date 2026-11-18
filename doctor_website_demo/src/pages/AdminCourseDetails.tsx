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
import { SESSION_INSTRUCTORS_EMBED, instructorName, instructorNames, type Instructor } from "../lib/instructors";
import { fetchInstructorsForCourse, setSessionInstructors } from "../lib/instructorCourses";
import { fetchLocations, type LocationRow } from "../lib/locations";
import { Skeleton, TableRowSkeleton } from "../components/Skeleton";

interface CourseDetail {
  id: string;
  title: string;
  description: string;
  price: number;
}

interface SessionRow {
  id: string;
  instructorIds: string[];
  instructorNames: string;
  active: boolean;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  maxStudents: number;
  locationId: string;
}

type NewSession = Pick<SessionRow, "startDate" | "endDate" | "startTime" | "endTime" | "maxStudents" | "locationId" | "instructorIds">;

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span className={`status-badge ${active ? "status-active" : "status-inactive"}`}>
      <span className="status-dot" />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function InstructorChecklist({
  instructors,
  selected,
  onChange,
}: {
  instructors: Instructor[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  if (instructors.length === 0) {
    return <p className="readonly-sub">No active teachers are authorized for this course. Authorize one under Users first.</p>;
  }
  return (
    <div className="course-list">
      {instructors.map((instructor) => {
        const inputId = `teacher-${instructor.id}`;
        return (
          <label key={instructor.id} htmlFor={inputId} className="course-option">
            <input
              id={inputId}
              type="checkbox"
              checked={selected.includes(instructor.id)}
              onChange={() => onChange(
                selected.includes(instructor.id)
                  ? selected.filter((id) => id !== instructor.id)
                  : [...selected, instructor.id],
              )}
            />
            {instructorName(instructor)}
          </label>
        );
      })}
    </div>
  );
}

function EditTeachersModal({
  session,
  instructors,
  onClose,
  onSave,
}: {
  session: SessionRow;
  instructors: Instructor[];
  onClose: () => void;
  onSave: (instructorIds: string[]) => Promise<string | null>;
}) {
  const [instructorIds, setInstructorIds] = useState(session.instructorIds);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const handleSubmit = async () => {
    if (pending) return;
    if (instructorIds.length === 0) {
      setError("Select at least one teacher");
      return;
    }
    setPending(true);
    setError("");
    const saveError = await onSave(instructorIds);
    setPending(false);
    if (saveError) setError(saveError);
    else onClose();
  };

  return (
    <div className="modal-overlay" onClick={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="teachers-modal-title">
        <button className="modal-close" onClick={onClose} disabled={pending} aria-label="Close"><X /></button>
        <p className="modal-eyebrow">{session.startDate}</p>
        <h2 id="teachers-modal-title">Class teachers</h2>
        <fieldset className="field" style={{ border: "none", padding: 0, margin: 0 }}>
          <legend className="readonly-label" style={{ marginBottom: 6 }}>Teachers</legend>
          <InstructorChecklist instructors={instructors} selected={instructorIds} onChange={(ids) => { setInstructorIds(ids); setError(""); }} />
        </fieldset>
        {error && <span className="field-error" role="alert"><AlertCircle />{error}</span>}
        <button className="btn-submit" onClick={handleSubmit} disabled={pending}>{pending ? "Saving…" : "Save teachers"}</button>
      </div>
    </div>
  );
}

function AddSessionModal({
  onClose,
  onAdd,
  instructors,
  locations,
}: {
  onClose: () => void;
  onAdd: (session: NewSession) => Promise<string | null>;
  instructors: Instructor[];
  locations: LocationRow[];
}) {
  const [instructorIds, setInstructorIds] = useState<string[]>([]);
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");
  const [maxStudents, setMaxStudents] = useState("20");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, pending]);

  const handleSubmit = async () => {
    if (pending) return;
    if (instructorIds.length === 0) {
      setError("Select at least one teacher");
      return;
    }
    if (!locationId || !startDate || !endDate || endDate < startDate || !startTime || !endTime || endTime <= startTime || !Number.isInteger(Number(maxStudents)) || Number(maxStudents) < 1) {
      setError("Enter a location, valid date and time range, and capacity of at least one.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const addError = await onAdd({ instructorIds, locationId, startDate, endDate, startTime, endTime, maxStudents: Number(maxStudents) });
      if (addError) setError(addError);
      else onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add session. Please try again.");
    } finally {
      setPending(false);
    }
  };

  const stopProp = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className="modal-overlay" onClick={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}>
      <div className="modal" onClick={stopProp} role="dialog" aria-modal="true" aria-labelledby="session-modal-title">
        <button className="modal-close" onClick={onClose} disabled={pending} aria-label="Close"><X /></button>

        <p className="modal-eyebrow">Schedule</p>
        <h2 id="session-modal-title">Add a class session</h2>

        <fieldset className="field" style={{ border: "none", padding: 0, margin: 0 }}>
          <legend className="readonly-label" style={{ marginBottom: 6 }}>Teachers</legend>
          <InstructorChecklist instructors={instructors} selected={instructorIds} onChange={(ids) => { setInstructorIds(ids); setError(""); }} />
          {error && <span className="field-error" role="alert"><AlertCircle />{error}</span>}
        </fieldset>

        <div className="field">
          <label htmlFor="session-location">Location</label>
          <select id="session-location" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
          </select>
        </div>
        <div className="field-row">
          <div className="field"><label htmlFor="session-start-date">Start date</label><input id="session-start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
          <div className="field"><label htmlFor="session-end-date">End date</label><input id="session-end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
        </div>
        <div className="field-row">
          <div className="field"><label htmlFor="session-start-time">Start time</label><input id="session-start-time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
          <div className="field"><label htmlFor="session-end-time">End time</label><input id="session-end-time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
        </div>
        <div className="field">
          <label htmlFor="session-capacity">Class capacity</label>
          <input id="session-capacity" type="number" min="1" value={maxStudents} onChange={(e) => setMaxStudents(e.target.value)} />
        </div>

        <button className="btn-submit" onClick={handleSubmit} disabled={pending}>{pending ? "Adding session…" : "Add session"}</button>
      </div>
    </div>
  );
}

export default function AdminCourseDetails() {
  const { id } = useParams<{ id: string }>();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<SessionRow | null>(null);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!id) {
      setLoadError("Missing course id");
      setLoading(false);
      return;
    }

    const [courseResult, sessionResult, instructorResult, locationResult] = await Promise.all([
      supabase
        .from("courses")
        .select("id, course_title, course_description, course_price")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("course_sessions")
        .select(`id, active, start_date, end_date, start_time, end_time, max_students, location_id, session_instructors ( instructor_id ), ${SESSION_INSTRUCTORS_EMBED}`)
        .eq("course_id", id),
      fetchInstructorsForCourse(id),
      fetchLocations(),
    ]);

    setInstructors(instructorResult.instructors);
    setLocations(locationResult.locations);

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

    setLoadError([sessionResult.error?.message, instructorResult.error, locationResult.error].filter(Boolean).join(" "));

    setCourse({
      id: courseResult.data.id,
      title: courseResult.data.course_title,
      description: courseResult.data.course_description ?? "",
      price: courseResult.data.course_price,
    });

    setSessions(
      (sessionResult.data ?? []).map((row) => {
        return {
          id: row.id,
          instructorIds: (row.session_instructors ?? []).map((assignment) => assignment.instructor_id),
          instructorNames: instructorNames(row.instructors, "Unassigned"),
          active: row.active,
          startDate: row.start_date ?? "",
          endDate: row.end_date ?? "",
          startTime: String(row.start_time ?? "").slice(0, 5),
          endTime: String(row.end_time ?? "").slice(0, 5),
          maxStudents: row.max_students ?? 0,
          locationId: row.location_id ?? "",
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

  const handleAdd = async (session: NewSession): Promise<string | null> => {
    if (!id) return "Missing course id";
    setActionError(null);

    const { data: created, error } = await supabase.from("course_sessions").insert({
      course_id: id,
      location_id: session.locationId,
      start_date: session.startDate,
      end_date: session.endDate,
      start_time: `${session.startTime}:00`,
      end_time: `${session.endTime}:00`,
      max_students: session.maxStudents,
      active: true,
    }).select("id").single();

    if (error || !created) return error?.message ?? "No session record was returned";

    const assignError = await setSessionInstructors(created.id, session.instructorIds);
    if (assignError) setActionError(`Session was created, but its teachers could not be assigned: ${assignError}. Use Edit teachers to retry.`);

    try {
      await loadData();
    } catch (err) {
      setActionError((previous) => [previous, `Session was created, but refreshing the session list failed: ${err instanceof Error ? err.message : "Request failed"}`].filter(Boolean).join(" "));
    }
    return null;
  };

  const handleSaveTeachers = async (sessionId: string, instructorIds: string[]): Promise<string | null> => {
    const saveError = await setSessionInstructors(sessionId, instructorIds);
    if (saveError) return saveError;
    await loadData();
    return null;
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
              <TableRowSkeleton cols={5} />
              <TableRowSkeleton cols={5} />
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
                    <th>Teachers</th>
                    <th>Dates</th>
                    <th>Time</th>
                    <th>Capacity</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id}>
                      <td className="muted">
                        <div className="cell-with-icon">
                          <User />
                          {s.instructorNames}
                        </div>
                        <button type="button" className="btn-link" onClick={() => setEditing(s)}>Edit teachers</button>
                      </td>
                      <td className="muted">{s.startDate}{s.endDate && s.endDate !== s.startDate ? ` – ${s.endDate}` : ""}</td>
                      <td className="muted">{s.startTime} – {s.endTime}</td>
                      <td className="muted">{s.maxStudents || "—"}</td>
                      <td><ActiveBadge active={s.active} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>

      {editing && (
        <EditTeachersModal
          session={editing}
          instructors={instructors}
          onClose={() => setEditing(null)}
          onSave={(instructorIds) => handleSaveTeachers(editing.id, instructorIds)}
        />
      )}

      {showModal && (
        <AddSessionModal
          onClose={() => setShowModal(false)}
          onAdd={handleAdd}
          instructors={instructors}
          locations={locations}
        />
      )}
    </>
  );
}
