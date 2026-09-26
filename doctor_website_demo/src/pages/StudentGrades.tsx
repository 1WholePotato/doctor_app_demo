import { useEffect, useState } from "react";
import {
  BookOpen, CheckCircle, XCircle, Clock, User, Download,
} from "lucide-react";
import { generateCertificatePdf, downloadCertificateFile } from "../lib/certificateGenerator";
import { uploadCertificateToR2 } from "../lib/storage";
import { useAuth } from "../context/useAuth";
import { fetchStudentCourses, type CourseStatus, type StudentCourseRow } from "../lib/studentCourses";
import { CourseCardSkeleton, StatCardSkeleton } from "../components/Skeleton";

function StatusBadge({ status }: { status: CourseStatus }) {
  const map = {
    pending: { label: "Pending", cls: "status-pending", Icon: Clock },
    passed: { label: "Passed", cls: "status-passed", Icon: CheckCircle },
    failed: { label: "Failed", cls: "status-failed", Icon: XCircle },
  };
  const { label, cls, Icon } = map[status];
  return (
    <span className={`status-badge ${cls}`}>
      <Icon aria-hidden="true" style={{ width: 12, height: 12 }} />
      {label}
    </span>
  );
}

export default function StudentGrades() {
  const { user, loading: authLoading } = useAuth();
  const [courses, setCourses] = useState<StudentCourseRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loading = authLoading || (Boolean(user) && dataLoading);

  const currentUser = user ? {
    id: user.id,
    name: `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || user.email,
  } : null;

  useEffect(() => {
    let cancelled = false;
    if (!user) return;

    async function load() {
      if (!user) return;
      setDataLoading(true);
      const result = await fetchStudentCourses(user.id);
      if (cancelled) return;

      if (result.error) {
        setLoadError(result.error);
      } else {
        setLoadError("");
        setCourses(result.courses);
      }
      setDataLoading(false);
    }

    void load();
    return () => { cancelled = true; };
  }, [user]);

  const handleDownloadCertificate = async (row: StudentCourseRow) => {
    try {
      setDownloadingId(row.bookingId);
      const studentName = currentUser?.name || "Healthcare Professional";
      const certBytes = await generateCertificatePdf({
        studentName,
        courseTitle: row.title,
        completionDate: new Date().toISOString().slice(0, 10),
        instructorName: row.instructor,
        certificateId: row.bookingId,
      });

      // Background upload to Cloudflare R2
      void uploadCertificateToR2(`certificates/${row.bookingId}.pdf`, certBytes);

      // Trigger immediate browser download
      downloadCertificateFile(certBytes, `Certificate-${row.title.replace(/\s+/g, "_")}.pdf`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not generate certificate";
      setLoadError(msg);
    } finally {
      setDownloadingId(null);
    }
  };

    const passed = courses.filter((e) => e.status === "passed").length;
  const pending = courses.filter((e) => e.status === "pending").length;
  const failed = courses.filter((e) => e.status === "failed").length;

  return (
    <>
        <main className="sg-main">
          <div className="sg-header">
            <p className="eyebrow">Academic record</p>
            <h1>My grades</h1>
          </div>

          {loadError && <p className="sg-error" role="alert">{loadError}</p>}

          {loading ? (
            <>
              <div className="sg-stats">
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
              </div>
              <p className="s-title" style={{ marginTop: 24 }}>All courses</p>
              <div className="sg-grid">
                <CourseCardSkeleton />
                <CourseCardSkeleton />
              </div>
            </>
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
                <div className="sg-empty">
                  <div className="sg-empty-icon"><BookOpen /></div>
                  <p className="sg-empty-title">No courses yet</p>
                  <p className="sg-empty-sub">Enrol in a course to see your grades here.</p>
                </div>
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
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 12, color: "var(--s-teal-mid)", fontWeight: 500 }}>
                              <CheckCircle style={{ width: 13, height: 13, verticalAlign: "middle", marginRight: 4 }} />
                              Complete
                            </span>
                            <button
                              type="button"
                              onMouseEnter={() => void import("pdf-lib")}
                              onFocus={() => void import("pdf-lib")}
                              onClick={() => handleDownloadCertificate(e)}
                              disabled={downloadingId === e.bookingId}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                background: "var(--s-teal-soft)",
                                color: "var(--s-teal-mid)",
                                border: "1px solid rgba(43,191,170,0.3)",
                                borderRadius: 6,
                                padding: "4px 8px",
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: downloadingId === e.bookingId ? "wait" : "pointer",
                              }}
                              title="Download 1-page completion certificate"
                            >
                              <Download style={{ width: 12, height: 12 }} />
                              {downloadingId === e.bookingId ? "Preparing..." : "Certificate"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
    </>
  );
}
