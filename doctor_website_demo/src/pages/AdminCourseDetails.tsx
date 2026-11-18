import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Plus, AlertCircle, User, ChevronLeft, Pencil } from "lucide-react";
import { supabase } from "../supabaseClient";
import { cancelClass, rescheduleClass, scheduleClass, type ClassSchedule, type ClassStatus } from "../lib/classes";
import { updateCourse, type CourseDraft } from "../lib/courses";
import { SESSION_INSTRUCTORS_EMBED, instructorName, instructorNames, type Instructor } from "../lib/instructors";
import { fetchInstructorsForCourse, setSessionInstructors } from "../lib/instructorCourses";
import { fetchLocations, type LocationRow } from "../lib/locations";
import { Skeleton, TableRowSkeleton } from "../components/Skeleton";
import CourseFormModal from "../components/CourseFormModal";
import { CancelClassModal, ClassFormModal, EditTeachersModal } from "../components/ClassModals";

interface CourseDetail extends CourseDraft {
  id: string;
}

interface ClassRow extends ClassSchedule {
  id: string;
  status: ClassStatus;
  rescheduled: boolean;
  cancellationReason: string | null;
  instructorIds: string[];
  instructorNames: string;
  locationName: string;
  booked: number;
}

type Dialog =
  | { kind: "course" }
  | { kind: "schedule" }
  | { kind: "reschedule"; row: ClassRow }
  | { kind: "teachers"; row: ClassRow }
  | { kind: "cancel"; row: ClassRow };

const CLASS_SELECT = `id, status, rescheduled_at, cancellation_reason, start_date, end_date, start_time, end_time, max_students, location_id,
  locations ( name ), session_instructors ( instructor_id ), ${SESSION_INSTRUCTORS_EMBED}, seats_taken`;

function classLabel(row: ClassRow): string {
  return row.endDate !== row.startDate ? `${row.startDate} – ${row.endDate}` : row.startDate;
}

function ClassStatusBadge({ row }: { row: ClassRow }) {
  if (row.status === "cancelled") {
    return (
      <span className="status-badge status-inactive" title={row.cancellationReason ?? undefined}>
        <span className="status-dot" />Cancelled
      </span>
    );
  }
  return (
    <span className="status-badge status-active">
      <span className="status-dot" />{row.rescheduled ? "Rescheduled" : "Scheduled"}
    </span>
  );
}

function toClassRow(row: Record<string, unknown>): ClassRow {
  const location = row.locations as { name?: string } | null;
  const assignments = (row.session_instructors ?? []) as { instructor_id: string }[];
  return {
    id: String(row.id),
    status: row.status === "cancelled" ? "cancelled" : "scheduled",
    rescheduled: Boolean(row.rescheduled_at),
    cancellationReason: typeof row.cancellation_reason === "string" ? row.cancellation_reason : null,
    locationId: String(row.location_id ?? ""),
    locationName: location?.name ?? "Location TBD",
    startDate: String(row.start_date ?? ""),
    endDate: String(row.end_date ?? ""),
    startTime: String(row.start_time ?? "").slice(0, 5),
    endTime: String(row.end_time ?? "").slice(0, 5),
    maxStudents: Number(row.max_students) || 0,
    instructorIds: assignments.map((assignment) => assignment.instructor_id),
    instructorNames: instructorNames(row.instructors, "Unassigned"),
    booked: Number(row.seats_taken) || 0,
  };
}

export default function AdminCourseDetails() {
  const { id } = useParams<{ id: string }>();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!id) {
      setLoadError("Missing course id");
      setLoading(false);
      return;
    }

    const [courseResult, classResult, instructorResult, locationResult] = await Promise.all([
      supabase
        .from("courses")
        .select("id, course_title, course_description, course_price, printed_material_fee, active")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("course_sessions")
        .select(CLASS_SELECT)
        .eq("course_id", id)
        .order("start_date")
        .order("start_time"),
      fetchInstructorsForCourse(id),
      fetchLocations(),
    ]);

    setInstructors(instructorResult.instructors);
    setLocations(locationResult.locations);

    if (courseResult.error || !courseResult.data) {
      setLoadError(courseResult.error?.message ?? "Course not found");
      setLoading(false);
      return;
    }

    setLoadError([classResult.error?.message, instructorResult.error, locationResult.error].filter(Boolean).join(" "));
    setCourse({
      id: courseResult.data.id,
      title: courseResult.data.course_title,
      description: courseResult.data.course_description ?? "",
      price: courseResult.data.course_price,
      printedMaterialFee: courseResult.data.printed_material_fee,
      active: courseResult.data.active,
    });
    setClasses((classResult.data ?? []).map((row) => toClassRow(row as Record<string, unknown>)));
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

  const afterChange = async (error: string | null) => {
    await loadData();
    return error;
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
          <p className="section-title">Classes</p>
        </div>
        <div className="sessions-card">
          <table className="sessions-table">
            <tbody>
              <TableRowSkeleton cols={7} />
              <TableRowSkeleton cols={7} />
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

        {loadError && <p className="load-error"><AlertCircle />{loadError}</p>}

        {course && (
          <div className="course-hero">
            <div className="hero-left">
              <p className="hero-eyebrow">Course detail</p>
              <h1 className="hero-title">{course.title}</h1>
              <p className="hero-desc">{course.description}</p>
              <p className="readonly-sub">
                Authorized teachers: {instructors.length > 0 ? instructors.map(instructorName).join(", ") : "none"}. Change authorizations under Users.
              </p>
            </div>
            <div className="hero-right">
              <span className={`status-badge ${course.active ? "status-active" : "status-inactive"}`}>
                <span className="status-dot" />{course.active ? "Active" : "Inactive"}
              </span>
              <p className="hero-price-label">Course price</p>
              <p className="hero-price">R {course.price.toLocaleString()}</p>
              <p className="hero-price-label">Printed material R {course.printedMaterialFee.toLocaleString()} · Electronic free</p>
              <button type="button" className="btn-link" onClick={() => setDialog({ kind: "course" })}><Pencil size={13} /> Edit course</button>
            </div>
          </div>
        )}

        <div className="section-header">
          <p className="section-title">Classes</p>
          <button className="btn-primary" onClick={() => setDialog({ kind: "schedule" })}>
            <Plus />Schedule class
          </button>
        </div>

        <div className="sessions-card">
          {classes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><User /></div>
              <p className="empty-title">No classes yet</p>
              <p className="empty-sub">Schedule a class with a location, dates, capacity and teachers.</p>
            </div>
          ) : (
            <table className="sessions-table">
              <thead>
                <tr>
                  <th>Dates</th>
                  <th>Time</th>
                  <th>Location</th>
                  <th>Teachers</th>
                  <th>Booked</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((row) => (
                  <tr key={row.id}>
                    <td className="muted">{classLabel(row)}</td>
                    <td className="muted">{row.startTime} – {row.endTime}</td>
                    <td className="muted">{row.locationName}</td>
                    <td className="muted">
                      <div className="cell-with-icon"><User />{row.instructorNames}</div>
                    </td>
                    <td className="muted">{row.booked} / {row.maxStudents}</td>
                    <td>
                      <ClassStatusBadge row={row} />
                      {row.status === "cancelled" && row.cancellationReason && <p className="readonly-sub">{row.cancellationReason}</p>}
                    </td>
                    <td>
                      {row.status === "scheduled" && (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, whiteSpace: "nowrap" }}>
                          <button type="button" className="btn-link" onClick={() => setDialog({ kind: "reschedule", row })}>Reschedule</button>
                          <button type="button" className="btn-link" onClick={() => setDialog({ kind: "teachers", row })}>Edit teachers</button>
                          <button type="button" className="btn-link" onClick={() => setDialog({ kind: "cancel", row })}>Cancel class</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {dialog?.kind === "course" && course && (
        <CourseFormModal
          initial={course}
          onClose={() => setDialog(null)}
          onSave={async (draft) => afterChange(await updateCourse(course.id, draft))}
        />
      )}

      {(dialog?.kind === "schedule" || dialog?.kind === "reschedule") && (
        <ClassFormModal
          mode={dialog.kind === "schedule"
            ? { kind: "schedule" }
            : { kind: "reschedule", heading: classLabel(dialog.row), initial: dialog.row, booked: dialog.row.booked }}
          instructors={instructors}
          locations={locations}
          onLocationCreated={(location) => setLocations((current) => [...current, location].sort((a, b) => a.name.localeCompare(b.name)))}
          onClose={() => setDialog(null)}
          onSubmit={async (schedule, instructorIds) => afterChange(
            dialog.kind === "schedule"
              ? await scheduleClass(id ?? "", schedule, instructorIds)
              : await rescheduleClass(dialog.row.id, schedule),
          )}
        />
      )}

      {dialog?.kind === "teachers" && (
        <EditTeachersModal
          heading={classLabel(dialog.row)}
          currentIds={dialog.row.instructorIds}
          instructors={instructors}
          onClose={() => setDialog(null)}
          onSave={async (instructorIds) => afterChange(await setSessionInstructors(dialog.row.id, instructorIds))}
        />
      )}

      {dialog?.kind === "cancel" && (
        <CancelClassModal
          heading={classLabel(dialog.row)}
          booked={dialog.row.booked}
          onClose={() => setDialog(null)}
          onCancel={async (reason) => afterChange(await cancelClass(dialog.row.id, reason))}
        />
      )}
    </>
  );
}
