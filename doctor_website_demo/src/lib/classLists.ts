import { supabase } from "../supabaseClient";
import { ACTIVE_BOOKING_STATUSES } from "./bookings";
import { SESSION_INSTRUCTORS_EMBED, instructorNames } from "./instructors";

export type UpcomingSession = {
  id: string;
  courseTitle: string;
  displayDate: string;
  instructor: string;
  bookedCount: number;
};

export type FetchUpcomingSessionsResult = {
  sessions: UpcomingSession[];
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

export async function fetchUpcomingSessions(): Promise<FetchUpcomingSessionsResult> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: sessionRows, error: sessionsError } = await supabase
    .from("course_sessions")
    .select(`
      id,
      start_date,
      courses ( id, course_title, active ),
      ${SESSION_INSTRUCTORS_EMBED},
      bookings ( count )
    `)
    .in("bookings.booking_status", [...ACTIVE_BOOKING_STATUSES])
    .eq("active", true)
    .gte("start_date", today)
    .order("start_date", { ascending: true })
    .limit(50);

  if (sessionsError) {
    return {
      sessions: [],
      error: `course_sessions: ${sessionsError.message}`,
    };
  }

  // Filter sessions that have an active course attached
  const validSessions = (sessionRows ?? []).filter((s) => {
    const course = asRecord(s.courses);
    return course && course.active !== false;
  });

  const sessions: UpcomingSession[] = [];

  for (const row of validSessions) {
    const course = asRecord(row.courses);
    if (!course) continue;

    const startDate = row.start_date ?? "";
    const bookings = Array.isArray(row.bookings) ? asRecord(row.bookings[0]) : null;

    sessions.push({
      id: row.id,
      courseTitle: readString(course, ["course_title"], "Untitled Course"),
      displayDate: startDate || "Upcoming",
      instructor: instructorNames(row.instructors, "Unassigned"),
      bookedCount: Number(bookings?.count) || 0,
    });
  }

  return {
    sessions,
    error: null,
  };
}
