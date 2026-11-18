import { beforeEach, describe, expect, it, vi } from "vitest";

const responses = new Map<string, { data: unknown; error: { message: string; code?: string } | null }>();
const calls: { table: string; method: string; args: unknown[] }[] = [];
const rpcCalls: { name: string; args: unknown }[] = [];
let rpcResponse: { error: { message: string } | null } = { error: null };

vi.mock("../src/supabaseClient", () => ({
  supabase: {
    from(table: string) {
      const query = {
        then(resolve: (value: unknown) => unknown) {
          return Promise.resolve(responses.get(table) ?? { data: [], error: null }).then(resolve);
        },
      } as Record<string, unknown>;
      for (const method of ["select", "eq", "in", "gte", "order", "limit", "insert", "single", "maybeSingle"]) {
        query[method] = (...args: unknown[]) => {
          calls.push({ table, method, args });
          return query;
        };
      }
      return query;
    },
    rpc(name: string, args: unknown) {
      rpcCalls.push({ name, args });
      return Promise.resolve(rpcResponse);
    },
  },
}));

const { cancelClass, rescheduleClass, scheduleClass, scheduleProblem } = await import("../src/lib/classes");
const { createLocation } = await import("../src/lib/locations");
const { fetchStudentCourses, nextBookedSession } = await import("../src/lib/studentCourses");
const { fetchUpcomingSessions } = await import("../src/lib/classLists");

const schedule = { locationId: "loc-1", startDate: "2027-01-10", endDate: "2027-01-11", startTime: "09:00", endTime: "15:30", maxStudents: 12 };

beforeEach(() => {
  responses.clear();
  calls.length = 0;
  rpcCalls.length = 0;
  rpcResponse = { error: null };
});

describe("scheduleProblem", () => {
  it("accepts a complete schedule", () => {
    expect(scheduleProblem(schedule)).toBeNull();
  });

  it.each([
    [{ locationId: "" }, "Choose a location."],
    [{ endDate: "2027-01-09" }, "The end date must be on or after the start date."],
    [{ endTime: "09:00" }, "The end time must be after the start time."],
    [{ maxStudents: 0 }, "Capacity must be a whole number of at least 1."],
    [{ maxStudents: 2.5 }, "Capacity must be a whole number of at least 1."],
  ])("rejects %o", (change, message) => {
    expect(scheduleProblem({ ...schedule, ...change })).toBe(message);
  });
});

describe("class administration calls", () => {
  it("schedules the class and its teachers in one database call", async () => {
    expect(await scheduleClass("course-1", schedule, ["i-1", "i-2"])).toBeNull();
    expect(rpcCalls).toEqual([{
      name: "schedule_class",
      args: {
        p_course_id: "course-1",
        p_location_id: "loc-1",
        p_start_date: "2027-01-10",
        p_end_date: "2027-01-11",
        p_start_time: "09:00",
        p_end_time: "15:30",
        p_max_students: 12,
        p_instructor_ids: ["i-1", "i-2"],
      },
    }]);
    expect(calls).toEqual([]);
  });

  it("reschedules through the database and reports a capacity refusal", async () => {
    rpcResponse = { error: { message: "Capacity 1 is below the 2 active bookings for this class" } };

    expect(await rescheduleClass("class-1", { ...schedule, maxStudents: 1 })).toBe("Capacity 1 is below the 2 active bookings for this class");
    expect(rpcCalls[0]).toMatchObject({ name: "reschedule_class", args: { p_course_session_id: "class-1", p_max_students: 1 } });
  });

  it("cancels with the admin's reason", async () => {
    expect(await cancelClass("class-1", "Venue flooded")).toBeNull();
    expect(rpcCalls).toEqual([{ name: "cancel_class", args: { p_course_session_id: "class-1", p_reason: "Venue flooded" } }]);
  });

  it("names a duplicate location instead of showing the raw constraint error", async () => {
    responses.set("locations", { data: null, error: { message: "duplicate key value violates unique constraint", code: "23505" } });

    expect(await createLocation(" Skills Lab ", "")).toEqual({ location: null, error: 'A location named "Skills Lab" already exists.' });
    expect(calls).toContainEqual({ table: "locations", method: "insert", args: [{ name: "Skills Lab", address: null }] });
  });
});

describe("student view of class changes", () => {
  const booking = (id: string, status: string, session: Record<string, unknown>) => ({
    id,
    booking_status: status,
    total_amount: 100,
    payments: [],
    course_sessions: {
      id: `session-${id}`,
      start_date: "2027-01-10",
      end_date: "2027-01-10",
      start_time: "09:00:00",
      end_time: "12:00:00",
      rescheduled_at: null,
      cancellation_reason: null,
      locations: { name: "Skills Lab", address: "2 Example Way" },
      courses: { id: "course-1", course_title: "Wound Care", course_description: "", course_price: 100 },
      instructors: [],
      ...session,
    },
  });

  it("shows the rescheduled dates, times and location", async () => {
    responses.set("bookings", {
      error: null,
      data: [booking("moved", "Confirmed", { start_date: "2027-02-01", end_date: "2027-02-02", start_time: "10:00:00", end_time: "13:00:00", rescheduled_at: "2026-11-18T10:00:00Z" })],
    });

    const { courses } = await fetchStudentCourses("student-1");

    expect(courses[0]).toMatchObject({
      sessionDate: "2027-02-01",
      schedule: "01 Feb 2027 – 02 Feb 2027, 10:00–13:00",
      location: "Skills Lab, 2 Example Way",
      rescheduled: true,
      classCancelled: false,
    });
  });

  it("shows a cancelled class with its reason and never offers it as the next session", async () => {
    responses.set("bookings", {
      error: null,
      data: [booking("gone", "Class Cancelled", { cancellation_reason: "Venue flooded" })],
    });

    const { courses } = await fetchStudentCourses("student-1");

    expect(courses[0]).toMatchObject({ classCancelled: true, cancellationReason: "Venue flooded" });
    expect(nextBookedSession(courses, "2026-11-18")).toBeNull();
  });

  it("lists only scheduled classes as upcoming", async () => {
    await fetchUpcomingSessions();

    expect(calls).toContainEqual({ table: "course_sessions", method: "eq", args: ["status", "scheduled"] });
  });
});
