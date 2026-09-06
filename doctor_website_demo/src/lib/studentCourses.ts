import { supabase } from "../supabaseClient";
import { instructorName } from "./instructors";

export type CourseStatus = "passed" | "failed" | "pending";

export type StudentCourseRow = {
  bookingId: string;
  courseId: string;
  title: string;
  description: string;
  price: number;
  paymentStatus: string;
  status: CourseStatus;
  instructor: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(record: Record<string, unknown>, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return fallback;
}

function statusFromPayment(paymentStatus: string): CourseStatus {
  const normalized = paymentStatus.toLowerCase();
  if (normalized === "passed" || normalized === "complete" || normalized === "completed") {
    return "passed";
  }
  if (normalized === "failed" || normalized === "fail") {
    return "failed";
  }
  return "pending";
}

export async function fetchStudentCourses(userId: string): Promise<{
  courses: StudentCourseRow[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("bookings")
    .select("id, course_id, payment_status, courses ( id, course_title, course_description, course_price )")
    .eq("user_id", userId);

  if (error) {
    return { courses: [], error: error.message };
  }

  const { data: sessions } = await supabase
    .from("course_sessions")
    .select("course_id, instructors ( first_name, last_name, email )")
    .eq("active", true);

  const instructorByCourse = new Map<string, string>();
  for (const row of sessions ?? []) {
    const record = asRecord(row);
    if (!record) continue;
    const courseId = readString(record, ["course_id"]);
    const instructor = asRecord(record.instructors);
    if (!courseId || !instructor || instructorByCourse.has(courseId)) continue;
    const name = `${readString(instructor, ["first_name"])} ${readString(instructor, ["last_name"])}`.trim();
    instructorByCourse.set(courseId, name || readString(instructor, ["email"], "TBD"));
  }

  const courses = (data ?? [])
    .map((row) => {
      const record = asRecord(row);
      if (!record) return null;
      const course = asRecord(record.courses);
      if (!course) return null;
      const paymentStatus = readString(record, ["payment_status"], "pending");
      const courseId = readString(course, ["id"]) || readString(record, ["course_id"]);
      const priceValue = course.course_price;
      return {
        bookingId: readString(record, ["id"]),
        courseId,
        title: readString(course, ["course_title"], "Untitled course"),
        description: readString(course, ["course_description"]),
        price: typeof priceValue === "number" ? priceValue : Number(priceValue) || 0,
        paymentStatus,
        status: statusFromPayment(paymentStatus),
        instructor: instructorByCourse.get(courseId) ?? "TBD",
      } satisfies StudentCourseRow;
    })
    .filter((row): row is StudentCourseRow => row !== null);

  return { courses, error: null };
}

export type StudentSessionRow = {
  id: string;
  date: string;
  location: string;
  instructor: string;
  duration: string;
  seatsLeft: number;
  totalSeats: number;
};

export type StudentCourseDetail = {
  id: string;
  title: string;
  description: string;
  category: string;
  duration: string;
  totalSeats: number;
};

function formatSessionDate(startDate: string): string {
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
      "id, start_date, start_time, end_time, max_students, active, instructors ( first_name, last_name, email ), locations ( name, address )",
    )
    .eq("course_id", courseId)
    .eq("active", true)
    .order("start_date");

  if (sessionsError) {
    return { course: null, sessions: [], error: sessionsError.message };
  }

  const sessions = (sessionRows ?? [])
    .map((row) => {
      const record = asRecord(row);
      if (!record) return null;
      const instructor = asRecord(record.instructors);
      const maxStudents = typeof record.max_students === "number"
        ? record.max_students
        : Number(record.max_students) || 0;
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
        // ponytail: per-session seat counts need bookings.session_id FK (issue #4)
        seatsLeft: maxStudents,
        totalSeats: maxStudents,
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
      totalSeats: firstSession?.totalSeats ?? 0,
    },
    sessions,
    error: null,
  };
}
