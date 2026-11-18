import { supabase } from "../supabaseClient";
import { CLASS_CANCELLED, SEAT_HOLDING_OR_CLASS_CANCELLED, bookingState, fetchSeatBookings, type BookingState, type SeatBooking } from "./bookings";
import { SESSION_INSTRUCTORS_EMBED, instructorNames } from "./instructors";
import { locationLabel } from "./locations";
import { fetchMaterialOptions, type MaterialOption } from "./materials";
import { paymentRecord, type PaymentRecord } from "./payments";

export type CourseStatus = "passed" | "failed" | "unavailable";

export type NextAction = "pay" | "book_again" | null;

export type StudentCourseRow = {
  bookingId: string;
  bookingStatus: string;
  state: BookingState;
  bookedAt: string;
  holdExpiresAt: string | null;
  material: string | null;
  courseId: string | null;
  sessionId: string | null;
  sessionDate: string | null;
  schedule: string | null;
  location: string | null;
  rescheduled: boolean;
  classCancelled: boolean;
  cancellationReason: string | null;
  title: string;
  description: string;
  price: number;
  payment: PaymentRecord;
  status: CourseStatus;
  instructor: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  const single = Array.isArray(value) ? value[0] : value;
  return single !== null && typeof single === "object" ? (single as Record<string, unknown>) : null;
}

function readString(record: Record<string, unknown>, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return fallback;
}

function records(value: unknown): Record<string, unknown>[] {
  return (Array.isArray(value) ? value : [])
    .map(asRecord)
    .filter((record): record is Record<string, unknown> => record !== null);
}

function utcInstant(timestamp: string): number {
  return Date.parse(/(Z|[+-]\d\d:?\d\d)$/i.test(timestamp) ? timestamp : `${timestamp}Z`);
}

function movedAfterBooking(session: Record<string, unknown>, booking: Record<string, unknown>): boolean {
  const rescheduledAt = readString(session, ["rescheduled_at"]);
  const bookedAt = readString(booking, ["created_at"]);
  if (!rescheduledAt) return false;
  return !bookedAt || utcInstant(rescheduledAt) > utcInstant(bookedAt);
}

function toStudentCourseRow(record: Record<string, unknown>): StudentCourseRow {
  const session = asRecord(record.course_sessions);
  const course = session ? asRecord(session.courses) : null;
  const bookingStatus = readString(record, ["booking_status"], "Pending");
  const holdExpiresAt = readString(record, ["expires_at"]) || null;
  const attemptStatuses = records(record.payment_attempts).map((attempt) => readString(attempt, ["status"]));
  const material = asRecord(record.material_types);
  const shared = {
    bookingId: readString(record, ["id"]),
    bookingStatus,
    state: bookingState({ bookingStatus, holdsSeat: record.holds_seat === true, expiresAt: holdExpiresAt, attemptStatuses }),
    bookedAt: readString(record, ["created_at"]),
    holdExpiresAt,
    material: material ? readString(material, ["name"]) || null : null,
    payment: paymentRecord(
      records(record.payments).map((payment) => readString(asRecord(payment.payment_statuses) ?? {}, ["name"])),
      attemptStatuses,
    ),
    status: "unavailable" as const,
    classCancelled: readString(record, ["booking_status"]) === CLASS_CANCELLED,
    price: Number(record.total_amount) || 0,
  };

  if (!session || !course) {
    return {
      ...shared,
      courseId: null,
      sessionId: null,
      sessionDate: null,
      schedule: null,
      location: null,
      rescheduled: false,
      cancellationReason: null,
      title: "Class to be confirmed",
      description: "This booking is being reviewed so it can be linked to a scheduled class.",
      instructor: "TBD",
    };
  }

  return {
    ...shared,
    courseId: readString(course, ["id"]),
    sessionId: readString(session, ["id"]),
    sessionDate: readString(session, ["start_date"]) || null,
    schedule: formatSchedule(session),
    location: readLocation(session),
    rescheduled: movedAfterBooking(session, record),
    cancellationReason: readString(session, ["cancellation_reason"]) || null,
    title: readString(course, ["course_title"], "Untitled course"),
    description: readString(course, ["course_description"]),
    instructor: instructorNames(session.instructors, "TBD"),
  };
}

const STUDENT_BOOKING_COLUMNS = `id, booking_status, total_amount, created_at, expires_at, holds_seat, material_types ( name ), payment_attempts ( status ), payments ( payment_statuses ( name ) ), course_sessions ( id, start_date, end_date, start_time, end_time, rescheduled_at, cancellation_reason, locations ( name, address ), courses ( id, course_title, course_description ), ${SESSION_INSTRUCTORS_EMBED} )`;

function toStudentCourseRows({ data, error }: { data: unknown[] | null; error: { message: string } | null }) {
  if (error) return { courses: [], error: error.message };
  return { courses: records(data).map(toStudentCourseRow), error: null };
}

export async function fetchStudentCourses(userId: string): Promise<{
  courses: StudentCourseRow[];
  error: string | null;
}> {
  return toStudentCourseRows(
    await supabase
      .from("bookings")
      .select(STUDENT_BOOKING_COLUMNS)
      .eq("user_id", userId)
      .or(SEAT_HOLDING_OR_CLASS_CANCELLED)
      .order("created_at"),
  );
}

export async function fetchBookingHistory(userId: string): Promise<{
  courses: StudentCourseRow[];
  error: string | null;
}> {
  return toStudentCourseRows(
    await supabase
      .from("bookings")
      .select(STUDENT_BOOKING_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  );
}

const REBOOKABLE: BookingState[] = ["expired", "failed", "cancelled"];
const KEEPS_PLACE: BookingState[] = ["held", "confirmed", "review"];

export function nextAction(row: StudentCourseRow, history: StudentCourseRow[], bookableCourseIds: ReadonlySet<string>): NextAction {
  if (row.state === "held") return "pay";
  if (!REBOOKABLE.includes(row.state) || !row.courseId || !bookableCourseIds.has(row.courseId)) return null;
  const alreadyPlaced = history.some((other) => other.courseId === row.courseId && KEEPS_PLACE.includes(other.state));
  return alreadyPlaced ? null : "book_again";
}

export function nextBookedSession(rows: StudentCourseRow[], today: string): StudentCourseRow | null {
  const upcoming = rows
    .filter((row) => row.sessionDate !== null && row.sessionDate >= today && !row.classCancelled && row.bookingStatus !== "Completed")
    .sort((a, b) => (a.sessionDate ?? "").localeCompare(b.sessionDate ?? ""));
  return upcoming[0] ?? null;
}

export type StudentSessionRow = {
  id: string;
  date: string;
  location: string;
  instructor: string;
  duration: string;
  capacity: number;
  seatsLeft: number;
};

export type StudentCourseDetail = {
  id: string;
  title: string;
  description: string;
  category: string;
  duration: string;
};

export function formatSessionDate(startDate: string): string {
  const parsed = Date.parse(startDate);
  if (Number.isNaN(parsed)) return startDate;
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(parsed));
}

function formatSessionDuration(startTime: string | null, endTime: string | null): string {
  if (startTime && endTime) {
    return `${startTime.slice(0, 5)}–${endTime.slice(0, 5)}`;
  }
  return "—";
}

function readLocation(record: Record<string, unknown>): string {
  const location = asRecord(record.locations);
  if (!location) return "Location TBD";
  return locationLabel({ name: readString(location, ["name"], "Location TBD"), address: readString(location, ["address"]) || null });
}

function formatSchedule(session: Record<string, unknown>): string | null {
  const startDate = readString(session, ["start_date"]);
  if (!startDate) return null;
  const endDate = readString(session, ["end_date"]);
  const dates = endDate && endDate !== startDate
    ? `${formatSessionDate(startDate)} – ${formatSessionDate(endDate)}`
    : formatSessionDate(startDate);
  return `${dates}, ${formatSessionDuration(readString(session, ["start_time"]) || null, readString(session, ["end_time"]) || null)}`;
}

export async function fetchStudentCourseDetail(courseId: string, userId: string): Promise<{
  course: StudentCourseDetail | null;
  sessions: StudentSessionRow[];
  materials: MaterialOption[];
  bookings: SeatBooking[];
  error: string | null;
}> {
  const { data: courseRow, error: courseError } = await supabase
    .from("courses")
    .select("id, course_title, course_description, active")
    .eq("id", courseId)
    .maybeSingle();

  if (courseError) {
    return { course: null, sessions: [], materials: [], bookings: [], error: courseError.message };
  }
  if (!courseRow?.active) {
    return { course: null, sessions: [], materials: [], bookings: [], error: "Course not found" };
  }

  const [{ data: sessionRows, error: sessionsError }, materialResult] = await Promise.all([
    supabase
      .from("course_sessions")
      .select(
        `id, start_date, start_time, end_time, max_students, seats_taken, ${SESSION_INSTRUCTORS_EMBED}, locations ( name, address )`,
      )
      .eq("course_id", courseId)
      .eq("status", "scheduled")
      .gte("start_date", new Date().toISOString().slice(0, 10))
      .order("start_date"),
    fetchMaterialOptions(courseId),
  ]);

  const loadError = sessionsError?.message ?? materialResult.error;
  if (loadError) {
    return { course: null, sessions: [], materials: [], bookings: [], error: loadError };
  }

  const sessions = (sessionRows ?? [])
    .map((row) => {
      const record = asRecord(row);
      if (!record) return null;
      const capacity = Number(record.max_students) || 0;
      return {
        id: readString(record, ["id"]),
        date: formatSessionDate(readString(record, ["start_date"], "Upcoming")),
        location: readLocation(record),
        instructor: instructorNames(record.instructors, "TBD"),
        duration: formatSessionDuration(
          typeof record.start_time === "string" ? record.start_time : null,
          typeof record.end_time === "string" ? record.end_time : null,
        ),
        capacity,
        seatsLeft: Math.max(0, capacity - (Number(record.seats_taken) || 0)),
      } satisfies StudentSessionRow;
    })
    .filter((row): row is StudentSessionRow => row !== null && Boolean(row.id));

  const bookingResult = await fetchSeatBookings(userId, sessions.map((session) => session.id));
  if (bookingResult.error) {
    return { course: null, sessions: [], materials: [], bookings: [], error: bookingResult.error };
  }

  const firstSession = sessions[0];
  return {
    course: {
      id: courseRow.id,
      title: readString(courseRow as Record<string, unknown>, ["course_title"], "Untitled course"),
      description: readString(courseRow as Record<string, unknown>, ["course_description"]),
      category: "Course",
      duration: firstSession?.duration ?? "—",
    },
    sessions,
    materials: materialResult.options,
    bookings: bookingResult.bookings,
    error: null,
  };
}

export type CatalogueClass = {
  id: string;
  schedule: string;
  location: string;
  instructor: string;
  seatsLeft: number;
};

export type CatalogueCourse = {
  id: string;
  title: string;
  description: string;
  materials: MaterialOption[];
  classes: CatalogueClass[];
};

function toCatalogueClass(session: Record<string, unknown>): CatalogueClass {
  return {
    id: readString(session, ["id"]),
    schedule: formatSchedule(session) ?? "Date to be confirmed",
    location: readLocation(session),
    instructor: instructorNames(session.instructors, "TBD"),
    seatsLeft: Math.max(0, (Number(session.max_students) || 0) - (Number(session.seats_taken) || 0)),
  };
}

export async function fetchCatalogue(): Promise<{ courses: CatalogueCourse[]; error: string | null }> {
  const { data, error } = await supabase
    .from("courses")
    .select(
      `id, course_title, course_description, course_sessions ( id, start_date, end_date, start_time, end_time, max_students, seats_taken, locations ( name, address ), ${SESSION_INSTRUCTORS_EMBED} )`,
    )
    .eq("active", true)
    .eq("course_sessions.bookable", true)
    .order("course_title")
    .order("start_date", { referencedTable: "course_sessions" });
  if (error) return { courses: [], error: error.message };

  const rows = records(data);
  const prices = await Promise.all(rows.map((row) => fetchMaterialOptions(readString(row, ["id"]))));
  const priceError = prices.find((result) => result.error)?.error;
  if (priceError) return { courses: [], error: priceError };

  return {
    courses: rows.map((row, index) => ({
      id: readString(row, ["id"]),
      title: readString(row, ["course_title"], "Untitled course"),
      description: readString(row, ["course_description"]),
      materials: prices[index].options,
      classes: records(row.course_sessions).map(toCatalogueClass),
    })),
    error: null,
  };
}
