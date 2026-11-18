import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invocations: { name: string; options: unknown }[] = [];
let invokeResult: { data: unknown; error: unknown } = { data: null, error: null };
const queries: [method: string, args: unknown[]][] = [];
let bookingRow: unknown = null;

vi.mock("../src/supabaseClient", () => ({
  supabase: {
    functions: {
      invoke(name: string, options: unknown) {
        invocations.push({ name, options });
        return Promise.resolve(invokeResult);
      },
    },
    from(table: string) {
      queries.push(["from", [table]]);
      const query: Record<string, unknown> = {
        maybeSingle: () => Promise.resolve({ data: bookingRow, error: null }),
      };
      for (const method of ["select", "eq"]) {
        query[method] = (...args: unknown[]) => {
          queries.push([method, args]);
          return query;
        };
      }
      return query;
    },
  },
}));

const { fetchBookingPayment, paymentOutcome, startPayment } = await import("../src/lib/payments");

function refusal(status: number, error: string) {
  return new FunctionsHttpError(new Response(JSON.stringify({ error }), { status }));
}

beforeEach(() => {
  invocations.length = 0;
  queries.length = 0;
  invokeResult = { data: null, error: null };
  bookingRow = null;
});

describe("startPayment", () => {
  it("sends only the booking to the checkout function and returns the Ozow URL", async () => {
    invokeResult = { data: { url: "https://pay.ozow.com/p-1/secure", reference: "DA0123456789", amount: 250 }, error: null };

    await expect(startPayment("booking-1")).resolves.toEqual({ url: "https://pay.ozow.com/p-1/secure", error: null });
    expect(invocations).toEqual([{ name: "ozow-checkout", options: { body: { bookingId: "booking-1" } } }]);
  });

  it.each([
    [refusal(409, "The seat hold on booking b-1 has expired"), "Your seat hold has expired. Book the class again."],
    [refusal(409, "Booking b-1 is not awaiting payment"), "This booking is not awaiting payment."],
    [refusal(403, "Booking b-1 belongs to another student"), "This booking belongs to another account."],
    [refusal(409, "Booking b-1 has nothing to pay"), "This booking has nothing to pay."],
    [refusal(409, "A payment on booking b-1 is under investigation with the bank"), "Your earlier payment is still being checked with your bank. Please don't pay again."],
    [refusal(503, "Online payment is not available yet."), "Online payment is not available yet."],
    [refusal(502, "Ozow could not start the payment. Try again."), "Could not start the payment. Try again."],
    [new FunctionsFetchError(new Error("offline")), "Could not start the payment. Try again."],
  ])("explains a refusal (%#)", async (error, explanation) => {
    invokeResult = { data: null, error };

    await expect(startPayment("booking-1")).resolves.toEqual({ url: null, error: explanation });
  });
});

describe("payment outcome", () => {
  const now = Date.parse("2026-11-20T10:00:00Z");
  const holdEnds = "2026-11-21T08:30:00+00:00";
  const lapsedAt = "2026-11-19T08:30:00+00:00";

  it.each([
    ["Confirmed", true, holdEnds, ["paid"], "paid"],
    ["Completed", true, holdEnds, [], "paid"],
    ["Pending", true, holdEnds, ["open"], "awaiting"],
    ["Pending", false, lapsedAt, ["open"], "lapsed"],
    ["Pending", false, lapsedAt, ["paid"], "late"],
    ["Expired", false, lapsedAt, ["failed", "paid"], "late"],
    ["Class Cancelled", false, holdEnds, ["paid"], "class_cancelled"],
    ["Cancelled", false, holdEnds, ["paid"], "booking_cancelled"],
    ["Pending", true, null, ["investigating"], "investigating"],
    ["Pending", false, lapsedAt, ["failed", "investigating"], "investigating"],
    ["Expired", false, null, ["failed"], "failed"],
    ["Expired", false, holdEnds, ["failed"], "failed"],
    ["Expired", false, lapsedAt, ["failed"], "lapsed"],
    ["Expired", false, lapsedAt, [], "lapsed"],
    ["Cancelled", false, holdEnds, [], "closed"],
    ["Class Cancelled", false, holdEnds, [], "closed"],
  ] as const)("a %s booking (holds seat %s, hold ends %s, attempts %j) reads as %s", (bookingStatus, holdsSeat, expiresAt, attempts, outcome) => {
    expect(paymentOutcome({ bookingStatus, holdsSeat, expiresAt, attemptStatuses: [...attempts] }, now)).toBe(outcome);
  });

  it("reads the student's own booking from the database", async () => {
    bookingRow = {
      id: "booking-1",
      booking_status: "Pending",
      total_amount: "250.00",
      expires_at: "2026-11-21T08:30:00+00:00",
      holds_seat: true,
      payment_attempts: [{ status: "open" }],
      course_sessions: { courses: { id: "course-1", course_title: "Wound Care" } },
    };

    await expect(fetchBookingPayment("booking-1", "student-1")).resolves.toEqual({
      payment: {
        bookingId: "booking-1",
        courseId: "course-1",
        courseTitle: "Wound Care",
        total: 250,
        expiresAt: "2026-11-21T08:30:00+00:00",
        holdsSeat: true,
        outcome: "awaiting",
      },
      error: null,
    });
    expect(queries).toEqual([
      ["from", ["bookings"]],
      ["select", ["id, booking_status, total_amount, expires_at, holds_seat, payment_attempts ( status ), course_sessions ( courses ( id, course_title ) )"]],
      ["eq", ["id", "booking-1"]],
      ["eq", ["user_id", "student-1"]],
    ]);
  });
});

describe("fetchBookingPayment after Ozow answers", () => {
  it("reads a booking whose payment arrived too late for a seat as a late payment", async () => {
    bookingRow = {
      id: "booking-2",
      booking_status: "Pending",
      total_amount: "100.00",
      expires_at: "2020-01-01T00:00:00+00:00",
      holds_seat: false,
      payment_attempts: [{ status: "paid" }],
      course_sessions: { courses: { id: "course-1", course_title: "Wound Care" } },
    };
    const { payment } = await fetchBookingPayment("booking-2", "student-1");
    expect(payment?.outcome).toBe("late");
  });

  it("reads a booking with no attempts embedded as before", async () => {
    bookingRow = {
      id: "booking-3",
      booking_status: "Expired",
      total_amount: "100.00",
      expires_at: "2020-01-01T00:00:00+00:00",
      holds_seat: false,
      payment_attempts: null,
      course_sessions: null,
    };
    const { payment } = await fetchBookingPayment("booking-3", "student-1");
    expect(payment?.outcome).toBe("lapsed");
  });
});
