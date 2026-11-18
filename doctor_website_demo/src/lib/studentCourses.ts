import { supabase } from "../supabaseClient";
import { ACTIVE_BOOKING_STATUSES, CLASS_CANCELLED } from "./bookings";
import { SESSION_INSTRUCTORS_EMBED, instructorNames } from "./instructors";
import { locationLabel } from "./locations";
import { fetchMaterialOptions, type MaterialOption } from "./materials";

export type CourseStatus = "passed" | "failed" | "unavailable";

export type StudentCourseRow = {
  bookingId: string;
  bookingStatus: string;
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
  paymentStatus: string;
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

function latestPaymentStatus(payments: unknown): string {
  const attempts = (Array.isArray(payments) ? payments : [])
    .map(asRecord)
    .filter((payment): payment is Record<string, unknown> => payment !== null)
    .sort((a, b) => readString(b, ["created_at"]).localeCompare(readString(a, ["created_at"])));
  const status = attempts[0] ? asRecord(attempts[0].payment_statuses) : null;
  return status ? readString(status, ["name"], "Pending") : "Pending";
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
  const shared = {
    bookingId: readString(record, ["id"]),
    bookingStatus: readString(record, ["booking_status"], "Pending"),
    paymentStatus: latestPaymentStatus(record.payments),
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

export async function fetchStudentCourses(userId: string): Promise<{
  courses: StudentCourseRow[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `id, booking_status, total_amount, created_at, course_sessions ( id, start_date, end_date, start_time, end_time, rescheduled_at, cancellation_reason, locations ( name, address ), courses ( id, course_title, course_description ), ${SESSION_INSTRUCTORS_EMBED} ), payments ( created_at, payment_statuses ( name ) )`,
    )
    .eq("user_id", userId)
    .in("booking_status", [...ACTIVE_BOOKING_STATUSES, CLASS_CANCELLED])
    .order("created_at");

  if (error) {
    return { courses: [], error: error.message };
  }

  const courses = (data ?? [])
    .map(asRecord)
    .filter((record): record is Record<string, unknown> => record !== null)
    .map(toStudentCourseRow);

  return { courses, error: null };
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

export async function fetchStudentCourseDetail(courseId: string): Promise<{
  course: StudentCourseDetail | null;
  sessions: StudentSessionRow[];
  materials: MaterialOption[];
  error: string | null;
}> {
  const { data: courseRow, error: courseError } = await supabase
    .from("courses")
    .select("id, course_title, course_description, active")
    .eq("id", courseId)
    .maybeSingle();

  if (courseError) {
    return { course: null, sessions: [], materials: [], error: courseError.message };
  }
  if (!courseRow?.active) {
    return { course: null, sessions: [], materials: [], error: "Course not found" };
  }

  const [{ data: sessionRows, error: sessionsError }, materialResult] = await Promise.all([
    supabase
      .from("course_sessions")
      .select(
        `id, start_date, start_time, end_time, ${SESSION_INSTRUCTORS_EMBED}, locations ( name, address )`,
      )
      .eq("course_id", courseId)
      .eq("status", "scheduled")
      .gte("start_date", new Date().toISOString().slice(0, 10))
      .order("start_date"),
    fetchMaterialOptions(courseId),
  ]);

  const loadError = sessionsError?.message ?? materialResult.error;
  if (loadError) {
    return { course: null, sessions: [], materials: [], error: loadError };
  }

  const sessions = (sessionRows ?? [])
    .map((row) => {
      const record = asRecord(row);
      if (!record) return null;
      return {
        id: readString(record, ["id"]),
        date: formatSessionDate(readString(record, ["start_date"], "Upcoming")),
        location: readLocation(record),
        instructor: instructorNames(record.instructors, "TBD"),
        duration: formatSessionDuration(
          typeof record.start_time === "string" ? record.start_time : null,
          typeof record.end_time === "string" ? record.end_time : null,
        ),
      } satisfies StudentSessionRow;
    })
    .filter((row): row is StudentSessionRow => row !== null && Boolean(row.id));

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
    error: null,
  };
}
