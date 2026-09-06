import { supabase } from "../supabaseClient";

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
