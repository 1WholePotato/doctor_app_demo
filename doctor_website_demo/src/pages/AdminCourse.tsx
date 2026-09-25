import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Plus, X, AlertCircle } from "lucide-react";
import { supabase } from "../supabaseClient";
import { fetchInstructors, instructorName, type Instructor } from "../lib/instructors";
import { grantInstructorCourse } from "../lib/instructorCourses";
import { firstLocationId } from "../lib/locations";
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
};

function AddCourseModal({
  onClose,
  onAdd,
  instructors,
}: {
  onClose: () => void;
  onAdd: (c: NewCourse) => void;
  instructors: Instructor[];
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructorId, setInstructorId] = useState(instructors[0]?.id ?? "");
  const [price, setPrice] = useState("");
  const [errors, setErrors] = useState<{ title?: string; price?: string; instructorId?: string }>({});

  const handleSubmit = () => {
    const newErrors: typeof errors = {};
    if (!title.trim()) newErrors.title = "Course title is required";
    if (!price || isNaN(Number(price)) || Number(price) <= 0)
      newErrors.price = "Enter a valid price";
    if (!instructorId) newErrors.instructorId = "Assign a teacher";
    if (Object.keys(newErrors).length) { setErrors(newErrors); return; }

    onAdd({
      title: title.trim(),
      description: description.trim(),
      price: Number(price),
      instructorId,
    });
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button className="modal-close" onClick={onClose} aria-label="Close"><X /></button>

        <p className="modal-eyebrow">New course</p>
        <h2 id="modal-title">Add a course</h2>

        <div className="field">
          <label htmlFor="course-title">Course title</label>
          <input
            id="course-title"
            type="text"
            placeholder="e.g. Advanced Human Anatomy"
            value={title}
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
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="course-teacher">Teacher</label>
            <select
              id="course-teacher"
              value={instructorId}
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
              onChange={(e) => { setPrice(e.target.value); setErrors((p) => ({ ...p, price: undefined })); }}
            />
            {errors.price && (
              <span className="field-error"><AlertCircle />{errors.price}</span>
            )}
          </div>
        </div>

        <button className="btn-submit" onClick={handleSubmit}>
          Create course
        </button>
      </div>
    </div>
  );
}

export default function AdminCourses() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadCourses = async () => {
    const [{ data, error }, instructorResult] = await Promise.all([
      supabase.from("courses").select("id, course_title, course_description, course_price").order("course_title"),
      fetchInstructors(),
    ]);

    setInstructors(instructorResult.instructors);

    if (error) {
      setLoadError(error.message);
      setLoading(false);
      return;
    }

    const { data: sessionRows } = await supabase
      .from("course_sessions")
      .select("course_id, instructors ( first_name, last_name, email )")
      .eq("active", true);

    const teacherByCourse = new Map<string, string>();
    for (const row of sessionRows ?? []) {
      const instructor = Array.isArray(row.instructors) ? row.instructors[0] : row.instructors;
      if (!row.course_id || !instructor || teacherByCourse.has(row.course_id)) continue;
      teacherByCourse.set(row.course_id, instructorName(instructor));
    }

    if (instructorResult.error) {
      setLoadError(instructorResult.error);
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

  const handleAdd = async (course: NewCourse) => {
    const { data, error } = await supabase
      .from("courses")
      .insert({
        course_title: course.title,
        course_description: course.description,
        course_price: course.price,
        active: true,
      })
      .select("id")
      .single();

    if (error || !data) {
      setActionError(error?.message ?? "Could not create course");
      return;
    }

    const locationId = await firstLocationId();
    if (!locationId) {
      setActionError("Add a location in the database before assigning a teacher.");
      return;
    }

    const { error: sessionError } = await supabase.from("course_sessions").insert({
      course_id: data.id,
      instructor_id: course.instructorId,
      location_id: locationId,
      start_date: new Date().toISOString().slice(0, 10),
      end_date: new Date().toISOString().slice(0, 10),
      start_time: "09:00:00",
      end_time: "12:00:00",
      max_students: 20,
      active: true,
    });

    if (sessionError) {
      setActionError(`Course created, but teacher assignment failed: ${sessionError.message}`);
    } else {
      const grantError = await grantInstructorCourse(course.instructorId, data.id);
      if (grantError) setActionError(grantError);
    }

    await loadCourses();
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
          onAdd={handleAdd}
          instructors={instructors}
        />
      )}
    </>
  );
}
