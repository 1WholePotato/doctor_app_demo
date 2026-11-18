// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const tables = new Map<string, unknown[]>();

vi.mock("../src/supabaseClient", () => ({
  supabase: {
    from(table: string) {
      const query = {
        then(resolve: (value: unknown) => unknown) {
          return Promise.resolve({ data: tables.get(table) ?? [], error: null }).then(resolve);
        },
      } as Record<string, unknown>;
      for (const method of ["select", "eq", "or", "order"]) query[method] = () => query;
      return query;
    },
    rpc() {
      return Promise.resolve({ data: [{ material_type_id: "m-e", name: "Electronic", material_fee: "0.00", total_amount: "250.00" }], error: null });
    },
  },
}));

const auth = { user: { id: "student-1" }, loading: false };
vi.mock("../src/context/useAuth", () => ({ useAuth: () => auth }));

const { default: StudentCourses } = await import("../src/pages/StudentCourses");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const course = { id: "course-1", course_title: "Wound Care", course_description: "Dressings" };
const session = { id: "class-1", start_date: "2027-03-02", end_date: "2027-03-02", start_time: "09:00:00", end_time: "12:00:00", courses: course, instructors: [] };
const cancelledSession = { ...session, cancellation_reason: "Venue flooded" };
const paid = { amount: "250.00", payment_statuses: { name: "Paid" } };

function booking(id: string, fields: Record<string, unknown>) {
  return { id, total_amount: "250.00", created_at: "2026-11-18T08:00:00", course_sessions: session, payments: [], payment_attempts: [], ...fields };
}

let container: HTMLDivElement;
let root: Root;

async function cards(bookings: unknown[]) {
  tables.set("bookings", bookings);
  tables.set("courses", [{ ...course, course_sessions: [{ ...session, id: "class-2", start_date: "2027-04-06", end_date: "2027-04-06", max_students: 8, seats_taken: 0 }] }]);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<MemoryRouter><StudentCourses /></MemoryRouter>));
  await act(async () => {});
  return Object.fromEntries([...container.querySelectorAll<HTMLElement>("[data-booking]")].map((card) => [card.dataset.booking, card.textContent ?? ""]));
}

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("student history cards", () => {
  it("says nothing was charged on an unpaid class cancellation and offers Book again", async () => {
    const shown = await cards([booking("unpaid", { booking_status: "Class Cancelled", holds_seat: false, course_sessions: cancelledSession })]);
    expect(shown.unpaid).toContain("This class was cancelled: Venue flooded. Nothing was charged.");
    expect(shown.unpaid).toContain("Payment: Not paid");
    expect(shown.unpaid).not.toContain("refund is arranged");
    expect(shown.unpaid).toContain("Book again");
  });

  it("keeps a paid class cancellation waiting for its refund, with no Book again", async () => {
    const shown = await cards([
      booking("paid", { booking_status: "Class Cancelled", holds_seat: false, course_sessions: cancelledSession, payment_attempts: [{ status: "paid" }], payments: [paid] }),
    ]);
    expect(shown.paid).toContain("Your booking and payment are kept while a refund is arranged.");
    expect(shown.paid).not.toContain("Book again");
  });

  it("offers no Book again on a cancelled booking while the student holds a confirmed seat on the course", async () => {
    const shown = await cards([
      booking("seat", { booking_status: "Confirmed", holds_seat: true, payments: [paid] }),
      booking("old", { booking_status: "Cancelled", holds_seat: false, created_at: "2026-11-16T08:00:00" }),
    ]);
    expect(shown.old).toContain("Cancelled");
    expect(shown.old).not.toContain("Book again");
    expect(shown.old).toContain("View course");
  });
});
