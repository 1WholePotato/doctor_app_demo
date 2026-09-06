import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Plus, X, AlertCircle } from "lucide-react";
import { supabase } from "../supabaseClient";
import AdminSidebar from "../components/AdminSidebar";
import { fetchInstructors, instructorName, type Instructor } from "../lib/instructors";
import { grantInstructorCourse } from "../lib/instructorCourses";
import { firstLocationId } from "../lib/locations";

// ─── Global styles (same token system as AdminLanding) ────────────────────────

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

  .ac-shell * { box-sizing: border-box; margin: 0; padding: 0; }
  .ac-shell { font-family: var(--font-body); background: var(--bg); min-height: 100vh; display: flex; }

  /* ── Sidebar (identical to AdminLanding) ── */
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

  /* ── Main ── */
  .ac-main { margin-left: 228px; flex: 1; padding: 40px 44px; }

  /* ── Page header ── */
  .ac-header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 32px; }
  .ac-header-left .eyebrow { font-size: 12px; font-weight: 500; color: var(--text-3); letter-spacing: .08em; text-transform: uppercase; margin-bottom: 6px; }
  .ac-header-left h1 { font-family: var(--font-display); font-size: 32px; font-weight: 300; color: var(--text-1); letter-spacing: -.01em; }
  .btn-primary { display: flex; align-items: center; gap: 7px; background: var(--text-1); color: #fff; border: none; padding: 11px 20px; border-radius: 10px; font-family: var(--font-body); font-size: 14px; font-weight: 500; cursor: pointer; transition: background .15s, transform .1s; }
  .btn-primary:hover { background: #2a2a28; transform: translateY(-1px); }
  .btn-primary svg { width: 16px; height: 16px; }

  /* ── Course grid ── */
  .course-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }

  .course-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    border-left: 3px solid var(--gold); padding: 22px 22px 18px;
    cursor: pointer; transition: transform .15s, box-shadow .15s;
    display: flex; flex-direction: column; gap: 10px;
    opacity: 0; animation: fadeUp .35s ease forwards;
  }
  .course-card:hover { transform: translateY(-3px); box-shadow: 0 10px 28px rgba(0,0,0,.08); }
  .course-card:nth-child(1) { animation-delay: .04s }
  .course-card:nth-child(2) { animation-delay: .1s }
  .course-card:nth-child(3) { animation-delay: .16s }
  .course-card:nth-child(4) { animation-delay: .22s }
  .course-card:nth-child(5) { animation-delay: .28s }

  .card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .card-title { font-family: var(--font-display); font-size: 17px; font-weight: 300; color: var(--text-1); line-height: 1.35; }
  .price-badge { background: var(--gold-soft); color: #7A5E1A; font-size: 13px; font-weight: 600; padding: 4px 10px; border-radius: 8px; white-space: nowrap; flex-shrink: 0; }
  .card-desc { font-size: 13px; color: var(--text-2); line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .card-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 4px; }
  .category-pill { font-size: 11px; font-weight: 500; color: var(--text-3); background: var(--bg); border: 1px solid var(--border); padding: 3px 10px; border-radius: 20px; }
  .card-arrow { font-size: 12px; color: var(--text-3); }

  /* ── Empty state ── */
  .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 20px; text-align: center; }
  .empty-icon { width: 60px; height: 60px; background: var(--gold-soft); border-radius: 16px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; }
  .empty-icon svg { width: 28px; height: 28px; color: var(--gold); }
  .empty-title { font-family: var(--font-display); font-size: 22px; font-weight: 300; color: var(--text-1); margin-bottom: 8px; }
  .empty-sub { font-size: 14px; color: var(--text-3); max-width: 280px; line-height: 1.6; }

  /* ── Modal overlay ── */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(17,17,16,.45);
    display: flex; align-items: center; justify-content: center;
    z-index: 100; padding: 20px;
    animation: fadeIn .15s ease;
  }
  .modal {
    background: var(--surface); border-radius: 18px; width: 100%; max-width: 480px;
    padding: 32px; position: relative;
    animation: slideUp .2s ease;
  }
  .modal-close { position: absolute; top: 20px; right: 20px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-2); transition: background .12s; }
  .modal-close:hover { background: var(--border); }
  .modal-close svg { width: 16px; height: 16px; }
  .modal-eyebrow { font-size: 11px; font-weight: 500; color: var(--text-3); letter-spacing: .08em; text-transform: uppercase; margin-bottom: 6px; }
  .modal h2 { font-family: var(--font-display); font-size: 24px; font-weight: 300; color: var(--text-1); margin-bottom: 28px; }

  /* ── Form fields ── */
  .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 18px; }
  .field label { font-size: 12px; font-weight: 500; color: var(--text-2); letter-spacing: .04em; text-transform: uppercase; }
  .field input, .field textarea, .field select {
    width: 100%; border: 1px solid var(--border); border-radius: 10px;
    padding: 11px 14px; font-family: var(--font-body); font-size: 14px; color: var(--text-1);
    background: #FAFAF8; outline: none; transition: border-color .15s;
    appearance: none;
  }
  .field input:focus, .field textarea:focus, .field select:focus { border-color: var(--gold); background: #fff; }
  .field textarea { resize: vertical; min-height: 90px; line-height: 1.6; }
  .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .field-error { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #C0392B; }
  .field-error svg { width: 13px; height: 13px; }

  .btn-submit { width: 100%; background: var(--text-1); color: #fff; border: none; padding: 13px; border-radius: 10px; font-family: var(--font-body); font-size: 14px; font-weight: 500; cursor: pointer; transition: background .15s; margin-top: 6px; }
  .btn-submit:hover { background: #2a2a28; }

  .load-error { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #C0392B; margin-bottom: 20px; }
  .load-error svg { width: 14px; height: 14px; }

  /* ── Animations ── */
  @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
`;

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
  const [loadError, setLoadError] = useState("");

  const loadCourses = async () => {
    const [{ data, error }, instructorResult] = await Promise.all([
      supabase.from("courses").select("id, course_title, course_description, course_price").order("course_title"),
      fetchInstructors(),
    ]);

    setInstructors(instructorResult.instructors);

    if (error) {
      setLoadError(error.message);
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
      alert(error?.message ?? "Could not create course");
      return;
    }

    const locationId = await firstLocationId();
    if (!locationId) {
      alert("Add a location in the database before assigning a teacher.");
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
      alert(`Course created, but teacher assignment failed: ${sessionError.message}`);
    } else {
      const grantError = await grantInstructorCourse(course.instructorId, data.id);
      if (grantError) alert(grantError);
    }

    await loadCourses();
  };

  return (
    <>
      <style>{globalStyles}</style>

      <div className="ac-shell">
        <AdminSidebar />

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

          {loadError && (
            <p className="load-error"><AlertCircle />{loadError}</p>
          )}

          {courses.length === 0 ? (
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
                  onClick={() => navigate(`/admincourses/${course.id}`, { state: { course } })}
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
      </div>

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
