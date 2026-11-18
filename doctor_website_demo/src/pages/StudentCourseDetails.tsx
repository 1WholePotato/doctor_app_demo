import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  CalendarDays, Clock,
  MapPin, User, ChevronLeft,
} from "lucide-react";
import PayButton from "../components/PayButton";
import { Skeleton, TableRowSkeleton } from "../components/Skeleton";
import { useAuth } from "../context/useAuth";
import { formatHoldExpiry, reserveSeat, type SeatBooking } from "../lib/bookings";
import {
  fetchStudentCourseDetail,
  type StudentCourseDetail,
  type StudentSessionRow,
} from "../lib/studentCourses";
import type { MaterialOption } from "../lib/materials";

function SeatsBadge({ session }: { session: StudentSessionRow }) {
  if (session.seatsLeft === 0) {
    return <span className="seats-badge seats-full"><span className="seats-dot" />Full</span>;
  }
  const tone = session.seatsLeft <= Math.max(2, Math.ceil(session.capacity / 5)) ? "seats-low" : "seats-ok";
  return (
    <span className={`seats-badge ${tone}`}>
      <span className="seats-dot" />{session.seatsLeft} of {session.capacity} seats left
    </span>
  );
}

function holdLabel(booking: SeatBooking): string {
  if (booking.status !== "Pending") return "Booked";
  return booking.expiresAt ? `Held until ${formatHoldExpiry(booking.expiresAt)}` : "Awaiting payment";
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StudentCourseDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const userId = user?.id;
  const routerLocation = useLocation();
  const passedCourse = (routerLocation.state as { course?: { courseId?: string; title?: string; description?: string } })?.course;

  const [course, setCourse] = useState<StudentCourseDetail | null>(null);
  const [sessions, setSessions] = useState<StudentSessionRow[]>([]);
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [bookings, setBookings] = useState<SeatBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [chosenMaterialId, setChosenMaterialId] = useState("");
  const [bookingClassId, setBookingClassId] = useState<string | null>(null);
  const [bookError, setBookError] = useState("");
  const [heldBooking, setHeldBooking] = useState<SeatBooking | null>(null);

  const materialId = materials.some((option) => option.id === chosenMaterialId) ? chosenMaterialId : materials[0]?.id ?? "";

  useEffect(() => {
    if (!id || !userId) {
      return;
    }

    let cancelled = false;

    async function load(resolvedId: string, resolvedUserId: string) {
      const result = await fetchStudentCourseDetail(resolvedId, resolvedUserId);
      if (cancelled) return;

      if (result.error) {
        setLoadError(result.error);
        setCourse(null);
        setSessions([]);
        setMaterials([]);
        setBookings([]);
      } else {
        setLoadError("");
        setCourse(result.course);
        setSessions(result.sessions);
        setMaterials(result.materials);
        setBookings(result.bookings);
      }
      setLoading(false);
    }

    void load(id, userId);
    return () => { cancelled = true; };
  }, [id, userId, reload]);

  const book = async (classId: string) => {
    setBookingClassId(classId);
    setBookError("");
    const result = await reserveSeat(classId, materialId);
    setBookingClassId(null);
    if (result.booking) {
      setHeldBooking(result.booking);
    } else {
      setBookError(result.error);
    }
    setReload((count) => count + 1);
  };

  const displayCourse = course ?? (passedCourse && id ? {
    id,
    title: passedCourse.title ?? "Course",
    description: passedCourse.description ?? "",
    category: "Course",
    duration: "—",
  } satisfies StudentCourseDetail : null);

  if (!id) {
    return (
      <>
        <main className="scd-main">
            <p className="scd-error">Missing course id.</p>
            <Link to="/courses" className="back-link"><ChevronLeft />Back to courses</Link>
          </main>
      </>
    );
  }

  return (
    <>
        {/* ── Main ── */}
        <main className="scd-main">
          <Link to="/courses" className="back-link"><ChevronLeft />Back to courses</Link>

          {loadError && <p className="scd-error">{loadError}</p>}

          {loading ? (
            <>
              <div className="hero">
                <div className="hero-left" style={{ width: "100%" }}>
                  <Skeleton width="100px" height={14} style={{ marginBottom: 10 }} />
                  <Skeleton width="50%" height={32} style={{ marginBottom: 12 }} />
                  <Skeleton width="80%" height={16} />
                </div>
              </div>
              <div className="s-header">
                <p className="s-title">Available sessions</p>
              </div>
              <div className="sessions-card">
                <table className="sessions-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Location</th>
                      <th>Instructor</th>
                      <th>Availability</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    <TableRowSkeleton cols={5} />
                    <TableRowSkeleton cols={5} />
                  </tbody>
                </table>
              </div>
            </>
          ) : displayCourse && (
          <>
          {/* Course hero */}
          <div className="hero">
            <div className="hero-left">
              <p className="eyebrow">{displayCourse.category}</p>
              <h1>{displayCourse.title}</h1>
              <p>{displayCourse.description || "No description provided."}</p>
            </div>
            <div className="hero-right">
              <span className="hero-cat">{displayCourse.category}</span>
              <span className="hero-meta"><Clock />Duration: {displayCourse.duration}</span>
            </div>
          </div>

          {materials.length > 0 && (
            <>
              <div className="s-header">
                <p className="s-title">Course material</p>
              </div>
              <div className="material-card" role="radiogroup" aria-label="Course material options">
                {materials.map((option) => (
                  <label key={option.id} className="material-option">
                    <input
                      type="radio"
                      name="material"
                      value={option.id}
                      checked={option.id === materialId}
                      onChange={() => setChosenMaterialId(option.id)}
                    />
                    <span className="material-name">{option.name}</span>
                    <span className="material-fee">{option.fee === 0 ? "Free" : `+ R ${option.fee.toLocaleString()}`}</span>
                    <span className="material-total">Total R {option.total.toLocaleString()}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          {/* Sessions */}
          <div className="s-header">
            <p className="s-title">Available sessions</p>
          </div>

          {heldBooking?.status === "Pending" && heldBooking.expiresAt && (
            <p className="scd-notice" role="status">
              Your seat is held until {formatHoldExpiry(heldBooking.expiresAt)}. Pay R {heldBooking.total.toLocaleString()} before then to keep it. Unpaid holds are released automatically.
            </p>
          )}
          {bookError && <p className="scd-error" role="alert">{bookError}</p>}

          <div className="sessions-card">
            {sessions.length === 0 && !loading ? (
              <p className="scd-empty">No upcoming sessions for this course.</p>
            ) : (
            <table className="sessions-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Location</th>
                  <th>Instructor</th>
                  <th>Availability</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => {
                    const booking = bookings.find((candidate) => candidate.classId === session.id);
                    return (
                    <tr key={session.id}>
                      <td>
                        <div className="cell-icon"><CalendarDays />{session.date}</div>
                      </td>
                      <td className="muted">
                        <div className="cell-icon"><MapPin />{session.location}</div>
                      </td>
                      <td className="muted">
                        <div className="cell-icon"><User />{session.instructor}</div>
                      </td>
                      <td>
                        <SeatsBadge session={session} />
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {booking ? (
                          <span className="booking-actions">
                            <span className="booked-label">{holdLabel(booking)}</span>
                            {booking.status === "Pending" && booking.expiresAt && <PayButton bookingId={booking.id} amount={booking.total} />}
                          </span>
                        ) : (
                          <button
                            className="book-btn"
                            type="button"
                            disabled={session.seatsLeft === 0 || !materialId || bookingClassId !== null}
                            onClick={() => void book(session.id)}
                          >
                            {bookingClassId === session.id ? "Booking…" : "Book now"}
                          </button>
                        )}
                      </td>
                    </tr>
                    );
                })}
              </tbody>
            </table>
            )}
          </div>
          </>
          )}
        </main>
    </>
  );
}
