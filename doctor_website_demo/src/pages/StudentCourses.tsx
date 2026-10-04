import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Search, User } from "lucide-react";
import { useAuth } from "../context/useAuth";
import { fetchStudentCourses, type StudentCourseRow } from "../lib/studentCourses";
import { supabase } from "../supabaseClient";
import { CourseCardSkeleton } from "../components/Skeleton";

interface CatalogCourse {
  id: string;
  course_title: string;
  course_description: string | null;
  course_price: number;
}

export default function StudentCourses() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"enrolled" | "catalog">("enrolled");
  const [query, setQuery] = useState("");
  const [courses, setCourses] = useState<StudentCourseRow[]>([]);
  const [catalog, setCatalog] = useState<CatalogCourse[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [enrolledError, setEnrolledError] = useState("");
  const [catalogError, setCatalogError] = useState("");

  const loading = authLoading || (Boolean(user) && dataLoading);

  useEffect(() => {
    let cancelled = false;
    if (!user) return;

    async function load() {
      if (!user) return;
      setDataLoading(true);
      try {
        const [result, catalogRes] = await Promise.all([
          fetchStudentCourses(user.id),
          supabase
            .from("courses")
            .select("id, course_title, course_description, course_price")
            .eq("active", true)
            .order("course_title"),
        ]);
        if (cancelled) return;

        setEnrolledError(result.error ?? "");
        setCourses(result.courses);
        setCatalogError(catalogRes.error?.message ?? "");
        setCatalog(catalogRes.data ?? []);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Could not load courses.";
        setEnrolledError(message);
        setCatalogError(message);
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [user]);

  const filtered = courses.filter((c) =>
    c.title.toLowerCase().includes(query.toLowerCase()) ||
    c.instructor.toLowerCase().includes(query.toLowerCase()),
  );

  const filteredCatalog = catalog.filter((c) =>
    c.course_title.toLowerCase().includes(query.toLowerCase()) ||
    (c.course_description ?? "").toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <>
        <main className="sc-main">
          <div className="sc-header">
            <div className="sc-header-left">
              <p className="eyebrow">Courses</p>
              <h1>{activeTab === "enrolled" ? "My courses" : "Course Catalog"}</h1>
              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => setActiveTab("enrolled")}
                  style={{
                    background: activeTab === "enrolled" ? "var(--s-teal)" : "var(--s-surface)",
                    color: activeTab === "enrolled" ? "#fff" : "var(--s-text-2)",
                    border: "1px solid var(--s-border)",
                    borderRadius: "20px",
                    padding: "6px 14px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  My Enrolments ({courses.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("catalog")}
                  style={{
                    background: activeTab === "catalog" ? "var(--s-teal)" : "var(--s-surface)",
                    color: activeTab === "catalog" ? "#fff" : "var(--s-text-2)",
                    border: "1px solid var(--s-border)",
                    borderRadius: "20px",
                    padding: "6px 14px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  All Courses ({catalog.length})
                </button>
              </div>
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

          {activeTab === "enrolled" && enrolledError && <p className="sc-error" role="alert">{enrolledError}</p>}
          {activeTab === "catalog" && catalogError && <p className="sc-error" role="alert">{catalogError}</p>}

          {loading ? (
            <div className="sc-grid">
              <CourseCardSkeleton />
              <CourseCardSkeleton />
              <CourseCardSkeleton />
              <CourseCardSkeleton />
            </div>
          ) : activeTab === "enrolled" ? (
            enrolledError && courses.length === 0 ? null : filtered.length === 0 ? (
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
                      <span className="status-badge status-pending">Result unavailable</span>
                    </div>

                    <p className="sc-card-desc">{course.description || "No description provided."}</p>

                    <div className="sc-meta-row">
                      <span className="sc-meta"><User />{course.instructor}</span>
                      <span className="sc-meta">R {course.price.toLocaleString()}</span>
                    </div>

                    <div className="sc-card-footer">
                      <span style={{ fontSize: 11, color: "var(--s-text-3)", background: "var(--s-bg)", border: "1px solid var(--s-border)", padding: "2px 9px", borderRadius: 20, fontWeight: 500 }}>
                        Payment status: {course.paymentStatus}
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
            )
          ) : (
            catalogError && catalog.length === 0 ? null : filteredCatalog.length === 0 ? (
              <div className="sc-empty">
                <div className="sc-empty-icon"><BookOpen /></div>
                <p className="sc-empty-title">No catalog courses found</p>
                <p className="sc-empty-sub">Try searching for another topic or course title.</p>
              </div>
            ) : (
              <div className="sc-grid">
                {filteredCatalog.map((course) => (
                  <div key={course.id} className="sc-card">
                    <div className="sc-card-top">
                      <h2 className="sc-card-title">{course.course_title}</h2>
                    </div>

                    <p className="sc-card-desc">{course.course_description || "No description provided."}</p>

                    <div className="sc-meta-row">
                      <span className="sc-meta">R {Number(course.course_price || 0).toLocaleString()}</span>
                    </div>

                    <div className="sc-card-footer">
                      <span style={{ fontSize: 11, color: "var(--s-teal-mid)", background: "var(--s-teal-soft)", border: "1px solid rgba(43,191,170,0.2)", padding: "2px 9px", borderRadius: 20, fontWeight: 600 }}>
                        Curriculum
                      </span>
                      <button
                        className="sc-enrol-btn"
                        onClick={() => navigate(`/courses/${course.id}`, { state: { course: { courseId: course.id, title: course.course_title, description: course.course_description ?? "" } } })}
                      >
                        Explore details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </main>
    </>
  );
}
