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

export async function fetchUpcomingSessions(): Promise<FetchUpcomingSessionsResult> {
  const { data: sessionRows, error: sessionsError } = await supabase
    .from("course_sessions")
    .select(`
      id,
      course_id,
      start_date,
      courses ( id, course_title, active ),
      instructors ( first_name, last_name, email )
    `)
    .eq("active", true)
    .order("start_date", { ascending: true })
    .limit(50);

  if (sessionsError) {
    return {
      sessions: [],
      sourceTable: null,
      error: `course_sessions: ${sessionsError.message}`,
    };
  }

  // Filter sessions that have an active course attached
  const validSessions = (sessionRows ?? []).filter((s) => {
    const course = asRecord(s.courses);
    return course && course.active !== false;
  });

  const courseIds = Array.from(new Set(validSessions.map((s) => s.course_id).filter((id): id is string => Boolean(id))));

  let bookingRows: RawRecord[] = [];
  if (courseIds.length > 0) {
    const { data, error } = await supabase
      .from("bookings")
      .select("id, user_id, course_id, payment_status, users ( first_name, last_name, email )")
      .in("course_id", courseIds)
      .eq("payment_status", "paid")
      .limit(500);
    if (!error && data) {
      bookingRows = data as RawRecord[];
    }
  }

  const attendeesByCourse = new Map<string, ClassAttendee[]>();
  for (const row of bookingRows) {
    const record = asRecord(row);
    if (!record) continue;
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

  const seenCourses = new Set<string>();
  const sessions: UpcomingSession[] = [];

  for (const row of validSessions) {
    const course = asRecord(row.courses);
    if (!course) continue;
    const courseId = row.course_id;
    if (seenCourses.has(courseId)) continue;
    seenCourses.add(courseId);

    const instructor = asRecord(row.instructors);
    const instName = instructor
      ? instructorName({
          first_name: readString(instructor, ["first_name"]),
          last_name: readString(instructor, ["last_name"]),
          email: readString(instructor, ["email"]),
        })
      : "Unassigned";

    const attendees = attendeesByCourse.get(courseId) ?? [];
    const startDate = row.start_date ?? "";

    sessions.push({
      id: courseId,
      courseTitle: readString(course, ["course_title"], "Untitled Course"),
      displayDate: startDate || "Upcoming",
      dateRaw: startDate || new Date().toISOString().slice(0, 10),
      instructor: instName,
      attendees,
      canDownload: true,
      downloadDisabledReason: attendees.length ? undefined : "No paid students on this course yet",
    });
  }

  return {
    sessions,
    sourceTable: "course_sessions",
    error: null,
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
