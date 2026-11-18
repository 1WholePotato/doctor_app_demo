import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data: unknown; error: { message: string } | null };
const responses = new Map<string, Result>();
const rpcResponses = new Map<string, Result>();
const calls: { table: string; method: string; args: unknown[] }[] = [];

vi.mock("../src/supabaseClient", () => ({
  supabase: {
    from(table: string) {
      const query = {
        then(resolve: (value: unknown) => unknown) {
          return Promise.resolve(responses.get(table) ?? { data: [], error: null }).then(resolve);
        },
      } as Record<string, unknown>;
      for (const method of ["select", "eq", "or", "order"]) {
        query[method] = (...args: unknown[]) => {
          calls.push({ table, method, args });
          return query;
        };
      }
      return query;
    },
    rpc(name: string, args: { p_course_id: string }) {
      calls.push({ table: name, method: "rpc", args: [args] });
      return Promise.resolve(rpcResponses.get(args.p_course_id) ?? { data: [], error: null });
    },
  },
}));

const { fetchBookingHistory, fetchCatalogue, nextAction } = await import("../src/lib/studentCourses");
const { paymentRecord } = await import("../src/lib/payments");

const course = { id: "course-1", course_title: "Wound Care", course_description: "Dressings" };
const session = { id: "class-1", start_date: "2027-03-02", end_date: "2027-03-02", start_time: "09:00:00", end_time: "12:00:00", courses: course, instructors: [] };
const hold = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();

function booking(id: string, fields: Record<string, unknown>) {
  return { id, total_amount: "250.00", created_at: "2026-11-18T08:00:00", course_sessions: session, payments: [], payment_attempts: [], ...fields };
}

beforeEach(() => {
  responses.clear();
  rpcResponses.clear();
  calls.length = 0;
});

describe("booking history", () => {
  it("asks for every booking of the student, newest first", async () => {
    await fetchBookingHistory("student-1");

    const bookingCalls = calls.filter((call) => call.table === "bookings");
    expect(bookingCalls.map((call) => call.method)).toEqual(["select", "eq", "order"]);
    expect(bookingCalls[1].args).toEqual(["user_id", "student-1"]);
    expect(bookingCalls[2].args).toEqual(["created_at", { ascending: false }]);
    expect(bookingCalls[0].args[0]).toContain("material_types ( name ), payment_attempts ( status ), payments ( payment_statuses ( name ) )");
  });

  it("reads each booking's state, material, stored total and verified payment", async () => {
    responses.set("bookings", {
      error: null,
      data: [
        booking("held", { booking_status: "Pending", holds_seat: true, expires_at: hold(10), material_types: { name: "Printed" }, payment_attempts: [{ status: "open" }] }),
        booking("failed", { booking_status: "Expired", holds_seat: false, expires_at: hold(10), payment_attempts: [{ status: "failed" }] }),
        booking("lapsed", { booking_status: "Pending", holds_seat: false, expires_at: hold(-1) }),
        booking("late", { booking_status: "Expired", holds_seat: false, expires_at: hold(-1), payment_attempts: [{ status: "paid" }], payments: [{ payment_statuses: { name: "Paid" } }] }),
        booking("paid", { booking_status: "Confirmed", holds_seat: true, payments: [{ payment_statuses: { name: "Paid" } }] }),
        booking("legacy", { booking_status: "Cancelled", holds_seat: false, payments: [{ payment_statuses: { name: "Pending" } }] }),
        booking("refund", {
          booking_status: "Class Cancelled",
          holds_seat: false,
          course_sessions: { ...session, cancellation_reason: "Venue flooded" },
          payment_attempts: [{ status: "paid" }],
          payments: [{ payment_statuses: { name: "Paid" } }],
        }),
      ],
    });

    const { courses, error } = await fetchBookingHistory("student-1");

    expect(error).toBeNull();
    expect(courses.map(({ bookingId, state, payment }) => [bookingId, state, payment])).toEqual([
      ["held", "held", "awaiting"],
      ["failed", "failed", "unpaid"],
      ["lapsed", "expired", "unpaid"],
      ["late", "review", "paid"],
      ["paid", "confirmed", "paid"],
      ["legacy", "cancelled", "unpaid"],
      ["refund", "class_cancelled", "paid"],
    ]);
    expect(courses[0]).toMatchObject({ material: "Printed", price: 250, bookedAt: "2026-11-18T08:00:00", courseId: "course-1" });
    expect(courses[6].cancellationReason).toBe("Venue flooded");
  });
});

describe("verified payment", () => {
  it.each([
    [["Paid"], [], "paid"],
    [[], ["paid"], "paid"],
    [["Paid", "Refunded"], ["paid"], "refunded"],
    [[], ["failed", "open"], "awaiting"],
    [["Pending", "Failed"], ["failed"], "unpaid"],
    [[], [], "unpaid"],
  ])("payments %j with attempts %j read as %s", (payments, attempts, record) => {
    expect(paymentRecord(payments, attempts)).toBe(record);
  });
});

describe("next action", () => {
  async function history(rows: ReturnType<typeof booking>[]) {
    responses.set("bookings", { error: null, data: rows });
    return (await fetchBookingHistory("student-1")).courses;
  }
  const bookable = new Set(["course-1"]);

  it.each([
    ["held", { booking_status: "Pending", holds_seat: true, expires_at: hold(10) }, "pay"],
    ["lapsed", { booking_status: "Pending", holds_seat: false, expires_at: hold(-1) }, "book_again"],
    ["failed", { booking_status: "Expired", holds_seat: false, expires_at: hold(10) }, "book_again"],
    ["cancelled", { booking_status: "Cancelled", holds_seat: false }, "book_again"],
    ["confirmed", { booking_status: "Confirmed", holds_seat: true }, null],
    ["class cancelled", { booking_status: "Class Cancelled", holds_seat: false }, null],
    ["under review", { booking_status: "Expired", holds_seat: false, expires_at: hold(-1), payment_attempts: [{ status: "paid" }] }, null],
  ])("a %s booking offers %s while its course has a bookable class", async (_, fields, action) => {
    const rows = await history([booking("b-1", fields)]);
    expect(nextAction(rows[0], rows, bookable)).toBe(action);
  });

  it("offers nothing for a lapsed booking once the course has no bookable class", async () => {
    const rows = await history([booking("b-1", { booking_status: "Expired", holds_seat: false, expires_at: hold(-1) })]);
    expect(nextAction(rows[0], rows, new Set())).toBeNull();
  });

  it("offers nothing for a lapsed booking once the student holds another seat on the course", async () => {
    const rows = await history([
      booking("new", { booking_status: "Pending", holds_seat: true, expires_at: hold(70) }),
      booking("old", { booking_status: "Expired", holds_seat: false, expires_at: hold(-1) }),
    ]);
    expect(rows.map((row) => nextAction(row, rows, bookable))).toEqual(["pay", null]);
  });
});

describe("catalogue", () => {
  it("lists active courses with their bookable classes and the price of each material", async () => {
    responses.set("courses", {
      error: null,
      data: [
        {
          ...course,
          course_sessions: [
            { ...session, max_students: 12, seats_taken: 11, locations: { name: "Skills Lab", address: null } },
            { ...session, id: "class-2", start_date: "2027-04-06", end_date: "2027-04-06", max_students: 8, seats_taken: 0 },
          ],
        },
        { id: "course-2", course_title: "Triage", course_description: "", course_sessions: [] },
      ],
    });
    rpcResponses.set("course-1", {
      error: null,
      data: [
        { material_type_id: "m-e", name: "Electronic", material_fee: "0.00", total_amount: "100.00" },
        { material_type_id: "m-p", name: "Printed", material_fee: "150.00", total_amount: "250.00" },
      ],
    });

    const { courses, error } = await fetchCatalogue();

    expect(error).toBeNull();
    expect(calls.filter((call) => call.table === "courses" && call.method === "eq").map((call) => call.args)).toEqual([
      ["active", true],
      ["course_sessions.bookable", true],
    ]);
    expect(courses).toEqual([
      {
        id: "course-1",
        title: "Wound Care",
        description: "Dressings",
        materials: [
          { id: "m-e", name: "Electronic", fee: 0, total: 100 },
          { id: "m-p", name: "Printed", fee: 150, total: 250 },
        ],
        classes: [
          expect.objectContaining({ id: "class-1", location: "Skills Lab", seatsLeft: 1 }),
          expect.objectContaining({ id: "class-2", seatsLeft: 8 }),
        ],
      },
      { id: "course-2", title: "Triage", description: "", materials: [], classes: [] },
    ]);
  });

  it("returns a price lookup error instead of a catalogue without prices", async () => {
    responses.set("courses", { error: null, data: [{ ...course, course_sessions: [] }] });
    rpcResponses.set("course-1", { data: null, error: { message: "permission denied for function course_material_prices" } });

    await expect(fetchCatalogue()).resolves.toEqual({ courses: [], error: "permission denied for function course_material_prices" });
  });
});
