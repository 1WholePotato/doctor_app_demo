import { beforeEach, describe, expect, it, vi } from "vitest";

const responses = new Map<string, { data: unknown; error: { message: string } | null }>();
const calls: { table: string; method: string; args: unknown[] }[] = [];
const rpcCalls: { name: string; args: unknown }[] = [];
const rpcResponses = new Map<string, { data: unknown; error: { message: string } | null }>();

vi.mock("../src/supabaseClient", () => ({
  supabase: {
    from(table: string) {
      const query = {
        then(resolve: (value: unknown) => unknown) {
          return Promise.resolve(responses.get(table) ?? { data: [], error: null }).then(resolve);
        },
      } as Record<string, unknown>;
      for (const method of ["select", "eq", "in", "or", "gte", "order", "maybeSingle"]) {
        query[method] = (...args: unknown[]) => {
          calls.push({ table, method, args });
          return query;
        };
      }
      return query;
    },
    rpc(name: string, args: unknown) {
      rpcCalls.push({ name, args });
      return Promise.resolve(rpcResponses.get(name) ?? { data: [], error: null });
    },
  },
}));

const { reserveSeat } = await import("../src/lib/bookings");
const { fetchStudentCourseDetail } = await import("../src/lib/studentCourses");

const heldRow = {
  id: "booking-1",
  course_session_id: "class-1",
  booking_status: "Pending",
  expires_at: "2026-11-21T08:30:00+00:00",
  material_type_id: "mt-p",
  total_amount: "250.00",
};

beforeEach(() => {
  responses.clear();
  calls.length = 0;
  rpcCalls.length = 0;
  rpcResponses.clear();
});

describe("reserveSeat", () => {
  it("books the class with the chosen material through one database call and returns the hold", async () => {
    rpcResponses.set("reserve_seat", { data: heldRow, error: null });

    const result = await reserveSeat("class-1", "mt-p");

    expect(rpcCalls).toEqual([{ name: "reserve_seat", args: { p_course_session_id: "class-1", p_material_type_id: "mt-p" } }]);
    expect(calls).toEqual([]);
    expect(result).toEqual({
      booking: { id: "booking-1", classId: "class-1", status: "Pending", expiresAt: "2026-11-21T08:30:00+00:00", materialTypeId: "mt-p", total: 250 },
      error: null,
    });
  });

  it.each([
    ["Class b1000000-0000-4000-8000-0000000000ff does not exist", "This class is no longer available. Refresh the page to see the current classes."],
    ["Class b0100000-0000-4000-8000-000000000052 is full", "This class is full."],
    ["Class b0100000-0000-4000-8000-000000000052 has already started", "This class has already started."],
    ["Class b0100000-0000-4000-8000-000000000053 is cancelled", "This class was cancelled."],
    ["Course b0100000-0000-4000-8000-000000000023 is not open for booking", "This course is not open for booking."],
    ["Only active students can book classes", "Only active student accounts can book classes."],
    ["something unexpected", "something unexpected"],
  ])("explains the refusal %j", async (message, explanation) => {
    rpcResponses.set("reserve_seat", { data: null, error: { message } });

    await expect(reserveSeat("class-1", "mt-e")).resolves.toEqual({ booking: null, error: explanation });
  });
});

describe("student course detail seats", () => {
  it("shows seats left from the seats taken and the student's own hold on each class", async () => {
    responses.set("courses", { data: { id: "course-1", course_title: "Wound Care", course_description: "", active: true }, error: null });
    responses.set("course_sessions", {
      error: null,
      data: [
        { id: "class-1", start_date: "2027-01-10", start_time: "09:00:00", end_time: "12:00:00", max_students: 20, seats_taken: 3, instructors: [], locations: null },
        { id: "class-2", start_date: "2027-02-10", start_time: "09:00:00", end_time: "12:00:00", max_students: 2, seats_taken: 2, instructors: [], locations: null },
      ],
    });
    responses.set("bookings", { data: [heldRow], error: null });

    const { sessions, bookings, error } = await fetchStudentCourseDetail("course-1", "student-1");

    expect(error).toBeNull();
    expect(sessions.map(({ id, capacity, seatsLeft }) => ({ id, capacity, seatsLeft }))).toEqual([
      { id: "class-1", capacity: 20, seatsLeft: 17 },
      { id: "class-2", capacity: 2, seatsLeft: 0 },
    ]);
    expect(bookings).toEqual([expect.objectContaining({ id: "booking-1", classId: "class-1", expiresAt: heldRow.expires_at })]);
    expect(calls.filter((call) => call.table === "bookings").map(({ method, args }) => [method, args])).toEqual([
      ["select", ["id, course_session_id, booking_status, expires_at, material_type_id, total_amount"]],
      ["eq", ["user_id", "student-1"]],
      ["eq", ["holds_seat", true]],
      ["in", ["course_session_id", ["class-1", "class-2"]]],
    ]);
  });
});
