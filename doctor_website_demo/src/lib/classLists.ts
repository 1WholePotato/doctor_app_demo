import { supabase } from "../supabaseClient";
import { instructorName } from "./instructors";

export type ClassAttendee = {
  firstName: string;
  lastName: string;
  email: string;
};

export type UpcomingSession = {
  id: string;
  courseTitle: string;
  displayDate: string;
  dateRaw: string;
  instructor: string;
  attendees: ClassAttendee[];
  canDownload: boolean;
  downloadDisabledReason?: string;
};

export type FetchUpcomingSessionsResult = {
  sessions: UpcomingSession[];
  sourceTable: string | null;
  error: string | null;
};

type RawRecord = Record<string, unknown>;

function asRecord(value: unknown): RawRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RawRecord)
    : null;
}

function readString(record: RawRecord, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return fallback;
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "course"
  );
}

function isPaid(status: string): boolean {
  return status.trim().toLowerCase() === "paid";
}

export async function fetchUpcomingSessions(): Promise<FetchUpcomingSessionsResult> {
  const errors: string[] = [];

  const { data: courses, error: coursesError } = await supabase
    .from("courses")
    .select("id, course_title, active")
    .eq("active", true)
    .order("course_title");

  if (coursesError) {
    return {
      sessions: [],
      sourceTable: null,
      error: `courses: ${coursesError.message}`,
    };
  }

  const { data: sessionRows, error: sessionsError } = await supabase
    .from("course_sessions")
    .select("id, course_id, instructor_id, active, start_date, instructors ( first_name, last_name, email )")
    .eq("active", true);

  if (sessionsError) {
    errors.push(`course_sessions: ${sessionsError.message}`);
  }

  const { data: bookingRows, error: bookingsError } = await supabase
    .from("bookings")
    .select("id, user_id, course_id, payment_status, users ( first_name, last_name, email )");

  if (bookingsError) {
    errors.push(`bookings: ${bookingsError.message}`);
  }

  const instructorByCourse = new Map<string, string>();
  const dateByCourse = new Map<string, string>();
  for (const row of sessionRows ?? []) {
    const record = asRecord(row);
    if (!record) continue;
    const courseId = readString(record, ["course_id"]);
    if (!courseId) continue;
    const startDate = readString(record, ["start_date"]);
    if (startDate && !dateByCourse.has(courseId)) dateByCourse.set(courseId, startDate);
    const instructor = asRecord(record.instructors);
    if (instructor && !instructorByCourse.has(courseId)) {
      instructorByCourse.set(courseId, instructorName({
        first_name: readString(instructor, ["first_name"]),
        last_name: readString(instructor, ["last_name"]),
        email: readString(instructor, ["email"]),
      }));
    }
  }

  const attendeesByCourse = new Map<string, ClassAttendee[]>();
  for (const row of bookingRows ?? []) {
    const record = asRecord(row);
    if (!record) continue;
    if (!isPaid(readString(record, ["payment_status"]))) continue;
    const courseId = readString(record, ["course_id"]);
    const user = asRecord(record.users);
    if (!courseId || !user) continue;
    const list = attendeesByCourse.get(courseId) ?? [];
    list.push({
      firstName: readString(user, ["first_name"]),
      lastName: readString(user, ["last_name"]),
      email: readString(user, ["email"]),
    });
    attendeesByCourse.set(courseId, list);
  }

  const sessions: UpcomingSession[] = (courses ?? []).map((course) => {
    const attendees = attendeesByCourse.get(course.id) ?? [];
    const startDate = dateByCourse.get(course.id) ?? "";
    return {
      id: course.id,
      courseTitle: course.course_title,
      displayDate: startDate || "Upcoming",
      dateRaw: startDate || new Date().toISOString().slice(0, 10),
      instructor: instructorByCourse.get(course.id) ?? "Unassigned",
      attendees,
      canDownload: true,
      downloadDisabledReason: attendees.length ? undefined : "No paid students on this course yet",
    };
  });

  return {
    sessions,
    sourceTable: "courses",
    error: errors.length ? errors.join(" · ") : null,
  };
}

export function downloadCsv(filename: string, rows: string[][]): void {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadClassListCsv(session: UpcomingSession): void {
  const rows: string[][] = [["Class", "Date", "Instructor", "Student name", "Student email"]];

  if (session.attendees.length === 0) {
    rows.push([session.courseTitle, session.displayDate, session.instructor, "", ""]);
  } else {
    for (const attendee of session.attendees) {
      rows.push([
        session.courseTitle,
        session.displayDate,
        session.instructor,
        `${attendee.firstName} ${attendee.lastName}`.trim(),
        attendee.email,
      ]);
    }
  }

  downloadCsv(`classlist-${slugify(session.courseTitle)}.csv`, rows);
}
