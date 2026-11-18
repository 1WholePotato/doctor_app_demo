import { supabase } from "../supabaseClient";
import { ACTIVE_BOOKING_STATUSES } from "./bookings";
import { instructorName } from "./instructors";

export type CourseStatus = "passed" | "failed" | "unavailable";

export type StudentCourseRow = {
  bookingId: string;
  bookingStatus: string;
  courseId: string | null;
  sessionId: string | null;
  sessionDate: string | null;
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

function toStudentCourseRow(record: Record<string, unknown>): StudentCourseRow {
  const session = asRecord(record.course_sessions);
  const course = session ? asRecord(session.courses) : null;
  const instructor = session ? asRecord(session.instructors) : null;
  const shared = {
    bookingId: readString(record, ["id"]),
    bookingStatus: readString(record, ["booking_status"], "Pending"),
    paymentStatus: latestPaymentStatus(record.payments),
    status: "unavailable" as const,
  };

  if (!session || !course) {
    return {
      ...shared,
      courseId: null,
      sessionId: null,
      sessionDate: null,
      title: "Class to be confirmed",
      description: "This booking is being reviewed so it can be linked to a scheduled class.",
      price: Number(record.total_amount) || 0,
      instructor: "TBD",
    };
  }

  return {
    ...shared,
    courseId: readString(course, ["id"]),
    sessionId: readString(session, ["id"]),
    sessionDate: readString(session, ["start_date"]) || null,
    title: readString(course, ["course_title"], "Untitled course"),
    description: readString(course, ["course_description"]),
    price: Number(course.course_price) || 0,
    instructor: instructor
      ? instructorName({
          first_name: readString(instructor, ["first_name"]),
          last_name: readString(instructor, ["last_name"]),
          email: readString(instructor, ["email"]),
        })
      : "TBD",
  };
}

export async function fetchStudentCourses(userId: string): Promise<{
  courses: StudentCourseRow[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, booking_status, total_amount, course_sessions ( id, start_date, courses ( id, course_title, course_description, course_price ), instructors ( first_name, last_name, email ) ), payments ( created_at, payment_statuses ( name ) )",
    )
    .eq("user_id", userId)
    .in("booking_status", [...ACTIVE_BOOKING_STATUSES])
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
    .filter((row) => row.sessionDate !== null && row.sessionDate >= today && row.bookingStatus !== "Completed")
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
  const name = readString(location, ["name"], "Location TBD");
  const address = readString(location, ["address"]);
  return address ? `${name}, ${address}` : name;
}

export async function fetchStudentCourseDetail(courseId: string): Promise<{
  course: StudentCourseDetail | null;
  sessions: StudentSessionRow[];
  error: string | null;
}> {
  const { data: courseRow, error: courseError } = await supabase
    .from("courses")
    .select("id, course_title, course_description, active")
    .eq("id", courseId)
    .maybeSingle();

  if (courseError) {
    return { course: null, sessions: [], error: courseError.message };
  }
  if (!courseRow?.active) {
    return { course: null, sessions: [], error: "Course not found" };
  }

  const { data: sessionRows, error: sessionsError } = await supabase
    .from("course_sessions")
    .select(
      "id, start_date, start_time, end_time, active, instructors ( first_name, last_name, email ), locations ( name, address )",
    )
    .eq("course_id", courseId)
    .eq("active", true)
    .gte("start_date", new Date().toISOString().slice(0, 10))
    .order("start_date");

  if (sessionsError) {
    return { course: null, sessions: [], error: sessionsError.message };
  }

  const sessions = (sessionRows ?? [])
    .map((row) => {
      const record = asRecord(row);
      if (!record) return null;
      const instructor = asRecord(record.instructors);
      return {
        id: readString(record, ["id"]),
        date: formatSessionDate(readString(record, ["start_date"], "Upcoming")),
        location: readLocation(record),
        instructor: instructor
          ? instructorName({
              first_name: readString(instructor, ["first_name"]),
              last_name: readString(instructor, ["last_name"]),
              email: readString(instructor, ["email"]),
            })
          : "TBD",
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
    error: null,
  };
}
