import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, CalendarDays, MapPin, Package, Search, User } from "lucide-react";
import PayButton from "../components/PayButton";
import { useAuth } from "../context/useAuth";
import { BOOKING_STATE_LABEL, formatHoldExpiry, type BookingState } from "../lib/bookings";
import {
  fetchBookingHistory,
  fetchCatalogue,
  formatSessionDate,
  nextAction,
  PAYMENT_LABEL,
  type CatalogueCourse,
  type StudentCourseRow,
} from "../lib/studentCourses";
import { CourseCardSkeleton } from "../components/Skeleton";

const STATE_TONE: Record<BookingState, string> = {
  held: "status-pending",
  investigating: "status-pending",
  confirmed: "status-passed",
  completed: "status-passed",
  review: "status-pending",
  class_cancelled: "status-failed",
  failed: "status-failed",
  expired: "status-failed",
  cancelled: "status-failed",
};

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className={`sc-tab${active ? " sc-tab-active" : ""}`} aria-pressed={active} onClick={onClick}>
      {children}
    </button>
  );
}

function StateNote({ booking }: { booking: StudentCourseRow }) {
  switch (booking.state) {
    case "held":
      return booking.holdExpiresAt ? (
        <p className="sc-meta" role="note">Seat held until {formatHoldExpiry(booking.holdExpiresAt)}. Pay before then to keep it.</p>
      ) : (
        <p className="sc-meta" role="note">Seat held until an administrator confirms your booking.</p>
      );
    case "investigating":
      return (
        <p className="sc-meta" role="note">
          Ozow is checking this payment with your bank by hand. No money has been recorded yet. Please don't pay again.{" "}
          {booking.holdsSeat
            ? "Your seat stays held until the check is finished."
            : "Your seat is no longer held, so if your bank confirms the payment an administrator will place you in a class or refund you."}
        </p>
      );
    case "failed":
      return <p className="sc-meta" role="note">Ozow reported the payment as cancelled or failed, so the seat was released.</p>;
    case "expired":
      return <p className="sc-meta" role="note">The seat hold ended before payment, so the seat was released.</p>;
    case "review":
      return <p className="sc-meta" role="note">Ozow confirmed your payment, but we could not confirm your seat automatically. An administrator will contact you to place you in a class or refund you.</p>;
    case "class_cancelled":
      return (
        <p className="sc-meta sc-note-alert" role="note">
          This class was cancelled{booking.cancellationReason ? `: ${booking.cancellationReason}` : ""}.{" "}
          {booking.payment === "refunded" ? "Your payment was refunded." : "Your booking and payment are kept while a refund is arranged."}
        </p>
      );
    default:
      return null;
  }
}

function BookingCard({ booking, history, bookableCourseIds }: { booking: StudentCourseRow; history: StudentCourseRow[]; bookableCourseIds: ReadonlySet<string> }) {
  const action = nextAction(booking, history, bookableCourseIds);
  const crossedOut = booking.state === "class_cancelled" ? { textDecoration: "line-through" } : undefined;

  return (
    <div className="sc-card" data-booking={booking.bookingId}>
      <div className="sc-card-top">
        <h2 className="sc-card-title">{booking.title}</h2>
        <span className="sc-badges">
          {booking.rescheduled && booking.state !== "class_cancelled" && <span className="status-badge status-pending">Rescheduled</span>}
          <span className={`status-badge ${STATE_TONE[booking.state]}`}>{BOOKING_STATE_LABEL[booking.state]}</span>
        </span>
      </div>

      {booking.schedule && (
        <div className="sc-meta-row">
          <span className="sc-meta" style={crossedOut}><CalendarDays />{booking.schedule}</span>
          {booking.location && <span className="sc-meta"><MapPin />{booking.location}</span>}
        </div>
      )}
      <div className="sc-meta-row">
        <span className="sc-meta"><User />{booking.instructor}</span>
        {booking.material && <span className="sc-meta"><Package />{booking.material} material</span>}
        <span className="sc-meta">R {booking.price.toLocaleString()}</span>
      </div>
      {booking.bookedAt && <p className="sc-meta">Booked {formatSessionDate(booking.bookedAt)}</p>}
      <StateNote booking={booking} />

      <div className="sc-card-footer">
        <span className="sc-pill">Payment: {PAYMENT_LABEL[booking.payment]}</span>
        <span className="booking-actions">
          {action === "pay" && <PayButton bookingId={booking.bookingId} amount={booking.price} />}
          {action === "book_again" && booking.courseId && (
            <Link className="sc-enrol-btn" to={`/courses/${booking.courseId}`}>Book again</Link>
          )}
          {action === null && booking.courseId && (
            <Link className="payment-secondary" to={`/courses/${booking.courseId}`}>View course</Link>
          )}
        </span>
      </div>
    </div>
  );
}

function CatalogueCard({ course }: { course: CatalogueCourse }) {
  return (
    <div className="sc-card" data-course={course.id}>
      <div className="sc-card-top">
        <h2 className="sc-card-title">{course.title}</h2>
      </div>
      <p className="sc-card-desc">{course.description || "No description provided."}</p>

      {course.materials.length > 0 && (
        <ul className="catalogue-list" aria-label="Price by material">
          {course.materials.map((option) => (
            <li key={option.id}><Package />{option.name} material <strong>R {option.total.toLocaleString()}</strong></li>
          ))}
        </ul>
      )}

      {course.classes.length === 0 ? (
        <p className="sc-meta">No upcoming classes are open for booking.</p>
      ) : (
        <ul className="catalogue-list" aria-label="Upcoming classes">
          {course.classes.map((session) => (
            <li key={session.id}>
              <CalendarDays />
              <span>{session.schedule} · {session.location}</span>
              <span className="catalogue-seats">{session.seatsLeft === 1 ? "1 seat left" : `${session.seatsLeft} seats left`}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="sc-card-footer">
        <span className="sc-pill">{course.classes.length === 1 ? "1 class" : `${course.classes.length} classes`}</span>
        {course.classes.length > 0 && <Link className="sc-enrol-btn" to={`/courses/${course.id}`}>Choose a class</Link>}
      </div>
    </div>
  );
}

function Empty({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="sc-empty">
      <div className="sc-empty-icon"><BookOpen /></div>
      <p className="sc-empty-title">{title}</p>
      <p className="sc-empty-sub">{sub}</p>
    </div>
  );
}

export default function StudentCourses() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"bookings" | "catalogue">("bookings");
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<StudentCourseRow[]>([]);
  const [catalogue, setCatalogue] = useState<CatalogueCourse[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [catalogueError, setCatalogueError] = useState("");

  const loading = authLoading || (Boolean(user) && dataLoading);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void Promise.all([fetchBookingHistory(user.id), fetchCatalogue()]).then(([bookings, courses]) => {
      if (cancelled) return;
      setHistory(bookings.courses);
      setHistoryError(bookings.error ?? "");
      setCatalogue(courses.courses);
      setCatalogueError(courses.error ?? "");
      setDataLoading(false);
    });
    return () => { cancelled = true; };
  }, [user]);

  const needle = query.toLowerCase();
  const bookableCourseIds = new Set(catalogue.filter((course) => course.classes.length > 0).map((course) => course.id));
  const shownHistory = history.filter((row) =>
    row.title.toLowerCase().includes(needle) || row.instructor.toLowerCase().includes(needle),
  );
  const shownCatalogue = catalogue.filter((course) =>
    course.title.toLowerCase().includes(needle) || course.description.toLowerCase().includes(needle),
  );
  const error = activeTab === "bookings" ? historyError : catalogueError;

  return (
    <main className="sc-main">
      <div className="sc-header">
        <div className="sc-header-left">
          <p className="eyebrow">Courses</p>
          <h1>{activeTab === "bookings" ? "My bookings" : "Course catalogue"}</h1>
          <div className="sc-tabs">
            <TabButton active={activeTab === "bookings"} onClick={() => setActiveTab("bookings")}>My bookings ({history.length})</TabButton>
            <TabButton active={activeTab === "catalogue"} onClick={() => setActiveTab("catalogue")}>Catalogue ({catalogue.length})</TabButton>
          </div>
        </div>
        <div className="search-wrap">
          <Search />
          <input className="search-input" type="text" placeholder="Search courses…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {error && <p className="sc-error" role="alert">{error}</p>}

      {loading ? (
        <div className="sc-grid">
          <CourseCardSkeleton />
          <CourseCardSkeleton />
          <CourseCardSkeleton />
        </div>
      ) : activeTab === "bookings" ? (
        shownHistory.length > 0 ? (
          <div className="sc-grid">
            {shownHistory.map((booking) => (
              <BookingCard key={booking.bookingId} booking={booking} history={history} bookableCourseIds={bookableCourseIds} />
            ))}
          </div>
        ) : !historyError && (
          <Empty title="No bookings found" sub={query ? "Try a different search term." : "Book a class from the catalogue to see it here."} />
        )
      ) : shownCatalogue.length > 0 ? (
        <div className="sc-grid">
          {shownCatalogue.map((course) => <CatalogueCard key={course.id} course={course} />)}
        </div>
      ) : !catalogueError && (
        <Empty title="No courses found" sub={query ? "Try a different search term." : "No courses are open for booking right now."} />
      )}
    </main>
  );
}
