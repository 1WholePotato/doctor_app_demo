import { supabase } from "../supabaseClient";
import { instructorName } from "./instructors";

export type UpcomingSession = {
  id: string;
  courseTitle: string;
  displayDate: string;
  instructor: string;
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
      instructors ( first_name, last_name, email )
    `)
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

    const instructorValue = row.instructors;
    const instructor = Array.isArray(instructorValue)
      ? asRecord(instructorValue[0])
      : asRecord(instructorValue);
    const instName = instructor
      ? instructorName({
          first_name: readString(instructor, ["first_name"]),
          last_name: readString(instructor, ["last_name"]),
          email: readString(instructor, ["email"]),
        })
      : "Unassigned";

    const startDate = row.start_date ?? "";

    sessions.push({
      id: row.id,
      courseTitle: readString(course, ["course_title"], "Untitled Course"),
      displayDate: startDate || "Upcoming",
      instructor: instName,
    });
  }

  return {
    sessions,
    error: null,
  };
}
