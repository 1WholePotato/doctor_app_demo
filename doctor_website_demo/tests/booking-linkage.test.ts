import { beforeEach, describe, expect, it, vi } from "vitest";

const responses = new Map<string, { data: unknown; error: { message: string } | null }>();
const calls: { table: string; method: string; args: unknown[] }[] = [];

vi.mock("../src/supabaseClient", () => ({
  supabase: {
    from(table: string) {
      const query = {
        then(resolve: (value: unknown) => unknown) {
          return Promise.resolve(responses.get(table) ?? { data: [], error: null }).then(resolve);
        },
      } as Record<string, unknown>;
      for (const method of ["select", "eq", "in", "gte", "order", "limit"]) {
        query[method] = (...args: unknown[]) => {
          calls.push({ table, method, args });
          return query;
        };
      }
      return query;
    },
  },
}));

const { fetchStudentCourses, nextBookedSession } = await import("../src/lib/studentCourses");
const { fetchUpcomingSessions } = await import("../src/lib/classLists");

const session = (id: string, courseId: string, title: string, date: string, instructor: string) => ({
  id,
  start_date: date,
  courses: { id: courseId, course_title: title, course_description: `${title} description`, course_price: 1500 },
  instructors: [{ first_name: instructor, last_name: "Mokoena", email: `${instructor}@example.test` }],
});

beforeEach(() => {
  responses.clear();
  calls.length = 0;
});

describe("fetchStudentCourses", () => {
  it("shows the booked class, its instructor and the latest payment attempt", async () => {
    responses.set("bookings", {
      error: null,
      data: [
        {
          id: "booking-1",
          booking_status: "Confirmed",
          total_amount: 1500,
          course_sessions: session("session-march", "course-1", "Wound Care", "2027-03-02", "Thandi"),
          payments: [
            { created_at: "2026-11-01T08:00:00", payment_statuses: { name: "Failed" } },
            { created_at: "2026-11-02T08:00:00", payment_statuses: { name: "Paid" } },
          ],
        },
      ],
    });

    const { courses, error } = await fetchStudentCourses("student-1");

    expect(error).toBeNull();
    expect(courses).toEqual([
      expect.objectContaining({
        bookingId: "booking-1",
        bookingStatus: "Confirmed",
        courseId: "course-1",
        sessionId: "session-march",
        sessionDate: "2027-03-02",
        title: "Wound Care",
        instructor: "Thandi Mokoena",
        paymentStatus: "Paid",
        price: 1500,
      }),
    ]);
  });

  it("asks only for the student's active bookings", async () => {
    await fetchStudentCourses("student-1");

    expect(calls).toContainEqual({ table: "bookings", method: "eq", args: ["user_id", "student-1"] });
    expect(calls).toContainEqual({
      table: "bookings",
      method: "in",
      args: ["booking_status", ["Pending", "Confirmed", "Completed"]],
    });
  });

  it("keeps a booking that awaits session review visible without a course link", async () => {
    responses.set("bookings", {
      error: null,
      data: [{ id: "booking-2", booking_status: "Pending", total_amount: 900, course_sessions: null, payments: [] }],
    });

    const { courses } = await fetchStudentCourses("student-1");

    expect(courses).toEqual([
      expect.objectContaining({
        bookingId: "booking-2",
        courseId: null,
        sessionId: null,
        title: "Class to be confirmed",
        price: 900,
        paymentStatus: "Pending",
      }),
    ]);
  });

  it("returns the query error", async () => {
    responses.set("bookings", { data: null, error: { message: "permission denied" } });

    await expect(fetchStudentCourses("student-1")).resolves.toEqual({ courses: [], error: "permission denied" });
  });
});

describe("nextBookedSession", () => {
  it("picks the earliest upcoming session the student is booked on", async () => {
    responses.set("bookings", {
      error: null,
      data: [
        { id: "late", booking_status: "Confirmed", course_sessions: session("s-late", "c-1", "Late", "2027-05-01", "A"), payments: [] },
        { id: "past", booking_status: "Confirmed", course_sessions: session("s-past", "c-2", "Past", "2026-01-01", "B"), payments: [] },
        { id: "soon", booking_status: "Pending", course_sessions: session("s-soon", "c-3", "Soon", "2026-12-01", "C"), payments: [] },
        { id: "unlinked", booking_status: "Pending", course_sessions: null, payments: [] },
      ],
    });
    const { courses } = await fetchStudentCourses("student-1");

    expect(nextBookedSession(courses, "2026-11-18")?.bookingId).toBe("soon");
    expect(nextBookedSession(courses, "2027-06-01")).toBeNull();
  });
});

describe("fetchUpcomingSessions", () => {
  it("names every instructor of a class and marks a class without one as unassigned", async () => {
    responses.set("course_sessions", {
      error: null,
      data: [
        {
          id: "session-1",
          start_date: "2026-12-01",
          courses: { id: "course-1", course_title: "Wound Care", active: true },
          instructors: [
            { first_name: "Thandi", last_name: "Mokoena", email: "t@example.test" },
            { first_name: "Anele", last_name: "Dube", email: "a@example.test" },
          ],
          bookings: [{ count: 0 }],
        },
        {
          id: "session-2",
          start_date: "2026-12-02",
          courses: { id: "course-1", course_title: "Wound Care", active: true },
          instructors: [],
          bookings: [{ count: 0 }],
        },
      ],
    });

    const { sessions } = await fetchUpcomingSessions();

    expect(sessions.map((session) => session.instructor)).toEqual(["Anele Dube, Thandi Mokoena", "Unassigned"]);
  });

  it("counts only active bookings for each class", async () => {
    responses.set("course_sessions", {
      error: null,
      data: [
        {
          id: "session-1",
          start_date: "2026-12-01",
          courses: { id: "course-1", course_title: "Wound Care", active: true },
          instructors: [{ first_name: "Thandi", last_name: "Mokoena", email: "t@example.test" }],
          bookings: [{ count: 2 }],
        },
      ],
    });

    const { sessions } = await fetchUpcomingSessions();

    expect(sessions).toEqual([
      { id: "session-1", courseTitle: "Wound Care", displayDate: "2026-12-01", instructor: "Thandi Mokoena", bookedCount: 2 },
    ]);
    expect(calls).toContainEqual({
      table: "course_sessions",
      method: "in",
      args: ["bookings.booking_status", ["Pending", "Confirmed", "Completed"]],
    });
  });
});
