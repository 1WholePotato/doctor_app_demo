import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Plus, X, AlertCircle } from "lucide-react";
import { supabase } from "../supabaseClient";
import { fetchInstructors, instructorName, type Instructor } from "../lib/instructors";
import { grantInstructorCourse } from "../lib/instructorCourses";
import { fetchLocations, type LocationRow } from "../lib/locations";
import { CourseCardSkeleton } from "../components/Skeleton";

// ─── Global styles (same token system as AdminLanding) ────────────────────────

interface Course {
  id: string;
  title: string;
  description: string;
  price: number;
  instructorName: string;
}

type NewCourse = {
  title: string;
  description: string;
  price: number;
  instructorId: string;
  locationId: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  maxStudents: number;
};

function AddCourseModal({
  onClose,
  canClose,
  onAdd,
  instructors,
  locations,
}: {
  onClose: () => void;
  canClose: boolean;
  onAdd: (c: NewCourse) => Promise<string | null>;
  instructors: Instructor[];
  locations: LocationRow[];
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructorId, setInstructorId] = useState(instructors[0]?.id ?? "");
  const [price, setPrice] = useState("");
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");
  const [maxStudents, setMaxStudents] = useState("20");
  const [errors, setErrors] = useState<{ title?: string; price?: string; instructorId?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const newErrors: typeof errors = {};
    if (!title.trim()) newErrors.title = "Course title is required";
    if (!price || isNaN(Number(price)) || Number(price) <= 0)
      newErrors.price = "Enter a valid price";
    if (!instructorId) newErrors.instructorId = "Assign a teacher";
    if (!locationId) newErrors.instructorId = "Choose a location before creating a course";
    if (!startDate || !endDate || endDate < startDate) newErrors.title = "Choose a valid session date range";
    if (!startTime || !endTime || endTime <= startTime) newErrors.price = "Choose a valid session time range";
    if (!Number.isInteger(Number(maxStudents)) || Number(maxStudents) < 1) newErrors.price = "Enter a valid class capacity";
    if (Object.keys(newErrors).length) { setErrors(newErrors); return; }

    setSubmitting(true);
    setSubmitError(null);
    let error: string | null;
    try {
      error = await onAdd({
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        instructorId,
        locationId,
        startDate,
        endDate,
        startTime,
        endTime,
        maxStudents: Number(maxStudents),
      });
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Could not finish course setup. Retry to resume without creating duplicates.";
    } finally {
      setSubmitting(false);
    }
    if (error) {
      setSubmitError(error);
      return;
    }
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && canClose && !submitting && !submitError) onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button className="modal-close" onClick={onClose} aria-label="Close" disabled={!canClose || submitting || Boolean(submitError)}><X /></button>

        <p className="modal-eyebrow">New course</p>
        <h2 id="modal-title">Add a course</h2>
        {!canClose && <p className="modal-eyebrow">A course draft is saved. Finish setup here to prevent losing the entered details.</p>}

        <div className="field">
          <label htmlFor="course-title">Course title</label>
          <input
            id="course-title"
            type="text"
            placeholder="e.g. Advanced Human Anatomy"
            value={title}
            disabled={!canClose || submitting || Boolean(submitError)}
            onChange={(e) => { setTitle(e.target.value); setErrors((p) => ({ ...p, title: undefined })); }}
          />
          {errors.title && (
            <span className="field-error"><AlertCircle />{errors.title}</span>
          )}
        </div>

        <div className="field">
          <label htmlFor="course-desc">Description</label>
          <textarea
            id="course-desc"
            placeholder="What will students learn in this course?"
            value={description}
            disabled={!canClose || submitting || Boolean(submitError)}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="course-teacher">Teacher</label>
            <select
              id="course-teacher"
              value={instructorId}
              disabled={!canClose || submitting || Boolean(submitError)}
              onChange={(e) => { setInstructorId(e.target.value); setErrors((p) => ({ ...p, instructorId: undefined })); }}
            >
              {instructors.length === 0 && <option value="">No teachers in database</option>}
              {instructors.map((instructor) => (
                <option key={instructor.id} value={instructor.id}>
                  {instructorName(instructor)}
                </option>
              ))}
            </select>
            {errors.instructorId && (
              <span className="field-error"><AlertCircle />{errors.instructorId}</span>
            )}
          </div>

          <div className="field">
            <label htmlFor="course-price">Price (R)</label>
            <input
              id="course-price"
              type="number"
              placeholder="e.g. 1499"
              min="0"
              value={price}
              disabled={!canClose || submitting || Boolean(submitError)}
              onChange={(e) => { setPrice(e.target.value); setErrors((p) => ({ ...p, price: undefined })); }}
            />
            {errors.price && (
              <span className="field-error"><AlertCircle />{errors.price}</span>
            )}
          </div>
        </div>

        <p className="modal-eyebrow">First session</p>
        <div className="field-row">
          <div className="field">
            <label htmlFor="session-location">Location</label>
            <select id="session-location" value={locationId} disabled={!canClose || submitting || Boolean(submitError)} onChange={(e) => setLocationId(e.target.value)}>
              {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="session-capacity">Class capacity</label>
            <input id="session-capacity" type="number" min="1" value={maxStudents} disabled={!canClose || submitting || Boolean(submitError)} onChange={(e) => setMaxStudents(e.target.value)} />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="session-start-date">Start date</label>
            <input id="session-start-date" type="date" value={startDate} disabled={!canClose || submitting || Boolean(submitError)} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="session-end-date">End date</label>
            <input id="session-end-date" type="date" value={endDate} disabled={!canClose || submitting || Boolean(submitError)} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="session-start-time">Start time</label>
            <input id="session-start-time" type="time" value={startTime} disabled={!canClose || submitting || Boolean(submitError)} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="session-end-time">End time</label>
            <input id="session-end-time" type="time" value={endTime} disabled={!canClose || submitting || Boolean(submitError)} onChange={(e) => setEndTime(e.target.value)} />
          </div>
        </div>

        {submitError && (
          <p className="load-error" role="alert"><AlertCircle />{submitError}</p>
        )}
        <button className="btn-submit" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Saving course…" : "Create course"}
        </button>
      </div>
    </div>
  );
}

export default function AdminCourses() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  // Keep partial setup state across retries while the modal is open. A retry
  // resumes this draft instead of creating another course or first session.
  const setupRef = React.useRef<{ courseId?: string; sessionId?: string; course?: NewCourse }>({});

  const loadCourses = async () => {
    const [{ data, error }, instructorResult, locationResult] = await Promise.all([
      supabase.from("courses").select("id, course_title, course_description, course_price").order("course_title"),
      fetchInstructors(),
      fetchLocations(),
    ]);

    setInstructors(instructorResult.instructors);
    setLocations(locationResult.locations);

    if (error) {
      setLoadError(error.message);
      setLoading(false);
      return;
    }

    const courseIds = (data ?? []).map((c) => c.id);
    let sessionRows: { course_id: string; instructors: unknown }[] = [];
    let sessionError: string | null = null;
    if (courseIds.length > 0) {
      const { data: rows, error: sessionsQueryError } = await supabase
        .from("course_sessions")
        .select("course_id, instructors ( first_name, last_name, email )")
        .in("course_id", courseIds)
        .eq("active", true);
      sessionError = sessionsQueryError?.message ?? null;
      if (rows) sessionRows = rows as { course_id: string; instructors: unknown }[];
    }

    const teacherByCourse = new Map<string, string>();
    for (const row of sessionRows ?? []) {
      const instructor = Array.isArray(row.instructors) ? row.instructors[0] : row.instructors;
      if (!row.course_id || !instructor || teacherByCourse.has(row.course_id)) continue;
      teacherByCourse.set(row.course_id, instructorName(instructor));
    }

    if (instructorResult.error || locationResult.error || sessionError) {
      setLoadError([instructorResult.error, locationResult.error, sessionError].filter(Boolean).join(" "));
    } else {
      setLoadError("");
    }

    setCourses(
      (data ?? []).map((course) => ({
        id: course.id,
        title: course.course_title,
        description: course.course_description ?? "",
        price: course.course_price,
        instructorName: teacherByCourse.get(course.id) ?? "Unassigned",
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      await loadCourses();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAdd = async (course: NewCourse): Promise<string | null> => {
    const fail = async (message: string) => {
      setActionError(message);
      await loadCourses();
      return message;
    };

    setupRef.current.course ??= course;
    course = setupRef.current.course;
    // Reuse a client-generated id if an insert committed but its response was
    // lost. This makes retries idempotent even before the server returns a row.
    setupRef.current.courseId ??= crypto.randomUUID();
    const courseId = setupRef.current.courseId;
    const { data: existingCourse, error: lookupCourseError } = await supabase
      .from("courses")
      .select("id")
      .eq("id", courseId)
      .maybeSingle();
    if (lookupCourseError) {
      return fail(`Could not check the saved course draft: ${lookupCourseError.message}. Retry to resume setup.`);
    }
    if (!existingCourse) {
      const { error: courseError } = await supabase
        .from("courses")
        .insert({
          id: courseId,
          course_title: course.title,
          course_description: course.description,
          course_price: course.price,
          active: false,
        });
      if (courseError) {
        const { data: insertedCourse, error: confirmError } = await supabase
          .from("courses")
          .select("id")
          .eq("id", courseId)
          .maybeSingle();
        if (confirmError || !insertedCourse) {
          return fail(`Could not save course draft ${courseId}: ${courseError.message}${confirmError ? ` (confirmation failed: ${confirmError.message})` : ""}. Retry to resume without creating a duplicate.`);
        }
      }
    }

    const sessionValues = {
      course_id: courseId,
      instructor_id: course.instructorId,
      location_id: course.locationId,
      start_date: course.startDate,
      end_date: course.endDate,
      start_time: `${course.startTime}:00`,
      end_time: `${course.endTime}:00`,
      max_students: course.maxStudents,
    };

    if (!setupRef.current.sessionId) {
      // A previous request may have committed while its response was lost.
      // Look for that exact first-session draft before attempting another insert.
      const { data: existing, error: lookupError } = await supabase
        .from("course_sessions")
        .select("id")
        .eq("course_id", courseId)
        .eq("instructor_id", course.instructorId)
        .eq("location_id", course.locationId)
        .eq("start_date", course.startDate)
        .eq("end_date", course.endDate)
        .eq("start_time", sessionValues.start_time)
        .eq("end_time", sessionValues.end_time)
        .eq("max_students", course.maxStudents)
        .maybeSingle();
      if (lookupError) {
        return fail(`Course draft ${courseId} is saved, but its first session could not be checked: ${lookupError.message}. Retry to resume setup.`);
      }
      setupRef.current.sessionId = existing?.id;

      if (!setupRef.current.sessionId) {
        const { data: session, error: sessionError } = await supabase
          .from("course_sessions")
          .insert({ ...sessionValues, active: false })
          .select("id")
          .single();
        if (sessionError || !session) {
          return fail(`Course draft ${courseId} is saved, but its first session was not confirmed: ${sessionError?.message ?? "No session record was returned"}. Retry to resume setup.`);
        }
        setupRef.current.sessionId = session.id;
      }
    }

    const sessionId = setupRef.current.sessionId;
    const grantError = await grantInstructorCourse(course.instructorId, courseId);
    if (grantError) {
      return fail(`Course draft ${courseId} and its first session are saved but remain inactive because instructor assignment failed: ${grantError}. Retry to resume setup.`);
    }

    const { error: sessionActivationError } = await supabase
      .from("course_sessions")
      .update({ active: true })
      .eq("id", sessionId);
    if (sessionActivationError) {
      return fail(`Course draft ${courseId} is saved and instructor assigned, but the first session could not be activated: ${sessionActivationError.message}. Retry to resume setup.`);
    }

    const { error: courseActivationError } = await supabase
      .from("courses")
      .update({ active: true })
      .eq("id", courseId);
    if (courseActivationError) {
      return fail(`First session and instructor assignment are ready, but course draft ${courseId} could not be activated: ${courseActivationError.message}. Retry to resume setup.`);
    }

    setupRef.current = {};
    setActionError(null);
    await loadCourses();
    return null;
  };

  return (
    <>

      <main className="ac-main">
          <div className="ac-header">
            <div className="ac-header-left">
              <p className="eyebrow">Curriculum</p>
              <h1>Courses</h1>
            </div>
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              <Plus /> Add course
            </button>
          </div>

                    {actionError && (
            <p className="load-error" style={{ marginBottom: 20 }}><AlertCircle />{actionError}</p>
          )}
          {loadError && (
            <p className="load-error"><AlertCircle />{loadError}</p>
          )}

          {loading ? (
            <div className="course-grid">
              <CourseCardSkeleton />
              <CourseCardSkeleton />
              <CourseCardSkeleton />
              <CourseCardSkeleton />
            </div>
          ) : courses.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><BookOpen /></div>
              <p className="empty-title">No courses yet</p>
              <p className="empty-sub">Add your first course and students will be able to enrol immediately.</p>
            </div>
          ) : (
            <div className="course-grid">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="course-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/admincourses/${course.id}`, { state: { course } })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/admincourses/${course.id}`, { state: { course } });
                    }
                  }}
                >
                  <div className="card-top">
                    <h3 className="card-title">{course.title}</h3>
                    <span className="price-badge">R {course.price.toLocaleString()}</span>
                  </div>
                  {course.description && (
                    <p className="card-desc">{course.description}</p>
                  )}
                  <div className="card-footer">
                    <span className="category-pill">{course.instructorName}</span>
                    <span className="card-arrow">View →</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

      {showModal && (
          <AddCourseModal
          onClose={() => setShowModal(false)}
          canClose={!setupRef.current.courseId}
          onAdd={handleAdd}
          instructors={instructors}
          locations={locations}
        />
      )}
    </>
  );
}
