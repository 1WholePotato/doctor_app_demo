import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Plus, AlertCircle } from "lucide-react";
import { supabase } from "../supabaseClient";
import { createCourse } from "../lib/courses";
import { CourseCardSkeleton } from "../components/Skeleton";
import CourseFormModal from "../components/CourseFormModal";

interface Course {
  id: string;
  title: string;
  description: string;
  price: number;
  active: boolean;
  upcomingClasses: number;
}

export default function AdminCourses() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadCourses = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [courseResult, classResult] = await Promise.all([
      supabase.from("courses").select("id, course_title, course_description, course_price, active").order("course_title"),
      supabase.from("course_sessions").select("course_id").eq("status", "scheduled").gte("start_date", today),
    ]);

    setLoadError([courseResult.error?.message, classResult.error?.message].filter(Boolean).join(" "));
    const upcoming = new Map<string, number>();
    for (const row of classResult.data ?? []) upcoming.set(row.course_id, (upcoming.get(row.course_id) ?? 0) + 1);

    setCourses(
      (courseResult.data ?? []).map((course) => ({
        id: course.id,
        title: course.course_title,
        description: course.course_description ?? "",
        price: course.course_price,
        active: course.active,
        upcomingClasses: upcoming.get(course.id) ?? 0,
      })),
    );
    setLoading(false);
  }, []);

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
  }, [loadCourses]);

  const openCourse = (id: string) => navigate(`/admincourses/${id}`);

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

        {loadError && <p className="load-error"><AlertCircle />{loadError}</p>}

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
            <p className="empty-sub">Add a course, then schedule its classes from the course page.</p>
          </div>
        ) : (
          <div className="course-grid">
            {courses.map((course) => (
              <div
                key={course.id}
                className="course-card"
                role="button"
                tabIndex={0}
                onClick={() => openCourse(course.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openCourse(course.id);
                  }
                }}
              >
                <div className="card-top">
                  <h3 className="card-title">{course.title}</h3>
                  <span className="price-badge">R {course.price.toLocaleString()}</span>
                </div>
                {course.description && <p className="card-desc">{course.description}</p>}
                <div className="card-footer">
                  <span className={`status-badge ${course.active ? "status-active" : "status-inactive"}`}>
                    <span className="status-dot" />{course.active ? "Active" : "Inactive"}
                  </span>
                  <span className="category-pill">
                    {course.upcomingClasses === 1 ? "1 upcoming class" : `${course.upcomingClasses} upcoming classes`}
                  </span>
                  <span className="card-arrow">View →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <CourseFormModal
          initial={null}
          onClose={() => setShowModal(false)}
          onSave={async (draft) => {
            const { id, error } = await createCourse(draft);
            if (error || !id) return error ?? "The course was not saved.";
            navigate(`/admincourses/${id}`);
            return null;
          }}
        />
      )}
    </>
  );
}
