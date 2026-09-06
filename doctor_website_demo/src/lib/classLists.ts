import { supabase } from "../supabaseClient";

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

const SESSION_TABLES = ["course_sessions", "sessions", "class_sessions"] as const;

const SELECT_BY_TABLE: Record<(typeof SESSION_TABLES)[number], string> = {
  course_sessions: `
    id, date, instructor, location,
    courses ( course_title ),
    bookings ( paid, payment_status, status, is_paid, users ( first_name, last_name, email ) )
  `,
  sessions: `
    id, date, instructor, location,
    courses ( course_title ),
    bookings ( paid, payment_status, status, is_paid, users ( first_name, last_name, email ) )
  `,
  class_sessions: `
    id, date, instructor, location,
    courses ( course_title ),
    bookings ( paid, payment_status, status, is_paid, users ( first_name, last_name, email ) )
  `,
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDisplayDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "session";
}

function asRecord(value: unknown): RawRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RawRecord)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(record: RawRecord, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return fallback;
}

function readDate(record: RawRecord): string {
  return readString(record, ["date", "session_date", "scheduled_at", "starts_at"]);
}

function readCourseTitle(record: RawRecord): string {
  const courses = asRecord(record.courses);
  if (courses) {
    const title = readString(courses, ["course_title", "title", "name"]);
    if (title) return title;
  }
  return readString(record, ["course_title", "title", "name"], "Untitled class");
}

function readInstructor(record: RawRecord): string {
  const direct = readString(record, ["instructor", "instructor_name"]);
  if (direct) return direct;

  const instructorUser = asRecord(record.instructor_user) ?? asRecord(record.users);
  if (instructorUser) {
    const first = readString(instructorUser, ["first_name"]);
    const last = readString(instructorUser, ["last_name"]);
    const combined = `${first} ${last}`.trim();
    if (combined) return combined;
  }

  return "TBD";
}

function detectPaidFields(booking: RawRecord): Set<string> {
  const fields = new Set<string>();
  if ("paid" in booking && typeof booking.paid === "boolean") fields.add("paid");
  if ("payment_status" in booking) fields.add("payment_status");
  if ("is_paid" in booking && typeof booking.is_paid === "boolean") fields.add("is_paid");
  if ("status" in booking && typeof booking.status === "string") fields.add("status");
  return fields;
}

function isPaidBooking(booking: RawRecord, paidFields: Set<string>): boolean {
  if (paidFields.has("paid") && booking.paid === true) return true;
  if (paidFields.has("payment_status") && booking.payment_status === "paid") return true;
  if (paidFields.has("is_paid") && booking.is_paid === true) return true;
  if (paidFields.has("status") && booking.status === "paid") return true;
  return false;
}

function readAttendee(booking: RawRecord): ClassAttendee | null {
  const users = asRecord(booking.users) ?? asRecord(booking.user);
  if (!users) return null;

  const firstName = readString(users, ["first_name"]);
  const lastName = readString(users, ["last_name"]);
  const email = readString(users, ["email"]);

  if (!firstName && !lastName && !email) return null;

  return { firstName, lastName, email };
}

function parseSessions(
  rows: unknown[],
  paidFilterAvailable: boolean,
  paidFields: Set<string>,
): UpcomingSession[] {
  return rows
    .map((row) => {
      const record = asRecord(row);
      if (!record) return null;

      const id = readString(record, ["id"]);
      const dateRaw = readDate(record);
      if (!id || !dateRaw) return null;

      const bookings = asArray(record.bookings)
        .map(asRecord)
        .filter((b): b is RawRecord => b !== null);

      const canDownload = paidFilterAvailable;

      const attendees = paidFilterAvailable
        ? bookings
            .filter((booking) => isPaidBooking(booking, paidFields))
            .map(readAttendee)
            .filter((attendee): attendee is ClassAttendee => attendee !== null)
        : [];

      return {
        id,
        courseTitle: readCourseTitle(record),
        displayDate: formatDisplayDate(dateRaw),
        dateRaw,
        instructor: readInstructor(record),
        attendees,
        canDownload,
        downloadDisabledReason: canDownload
          ? undefined
          : "Paid attendee data not available yet",
      } satisfies UpcomingSession;
    })
    .filter((session): session is UpcomingSession => session !== null);
}

async function tryFetchFromTable(
  table: (typeof SESSION_TABLES)[number],
  today: string,
): Promise<
  | { rows: unknown[]; paidFilterAvailable: boolean; paidFields: Set<string> }
  | { error: string }
> {
  const { data, error } = await supabase
    .from(table)
    .select(SELECT_BY_TABLE[table])
    .gte("date", today)
    .order("date", { ascending: true });

  if (error) {
    return { error: error.message };
  }

  const rows = data ?? [];

  const allBookings = rows
    .flatMap((row) => asArray(asRecord(row)?.bookings))
    .map(asRecord)
    .filter((booking): booking is RawRecord => booking !== null);

  let paidFields = new Set<string>();
  for (const booking of allBookings) {
    paidFields = detectPaidFields(booking);
    if (paidFields.size > 0) break;
  }

  const paidFilterAvailable = paidFields.size > 0;

  return { rows, paidFilterAvailable, paidFields };
}

export async function fetchUpcomingSessions(): Promise<FetchUpcomingSessionsResult> {
  const today = todayIsoDate();
  const errors: string[] = [];

  for (const table of SESSION_TABLES) {
    const result = await tryFetchFromTable(table, today);
    if ("error" in result) {
      errors.push(`${table}: ${result.error}`);
      continue;
    }

    const sessions = parseSessions(
      result.rows,
      result.paidFilterAvailable,
      result.paidFields,
    );
    return {
      sessions,
      sourceTable: table,
      error: null,
    };
  }

  return {
    sessions: [],
    sourceTable: null,
    error: errors.join(" · ") || "Could not load upcoming sessions",
  };
}

export function downloadCsv(filename: string, rows: string[][]): void {
  const csv = rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
    )
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
  const rows: string[][] = [
    ["Class", "Date", "Instructor", "Student name", "Student email"],
  ];

  for (const attendee of session.attendees) {
    rows.push([
      session.courseTitle,
      session.displayDate,
      session.instructor,
      `${attendee.firstName} ${attendee.lastName}`.trim(),
      attendee.email,
    ]);
  }

  const datePart = session.dateRaw.slice(0, 10);
  downloadCsv(`classlist-${slugify(session.courseTitle)}-${datePart}.csv`, rows);
}
