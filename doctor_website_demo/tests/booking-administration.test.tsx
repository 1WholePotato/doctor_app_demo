// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data: unknown; error: { message: string; code?: string } | null };
const calls: { table: string; method: string; args: unknown[] }[] = [];
let tableResult: Result = { data: [], error: null };
const tableResults = new Map<string, Result>();
let rpcResult: Result = { data: null, error: null };

vi.mock("../src/supabaseClient", () => ({
  supabase: {
    from(table: string) {
      const query = {
        then(resolve: (value: unknown) => unknown) {
          return Promise.resolve(tableResults.get(table) ?? tableResult).then(resolve);
        },
      } as Record<string, unknown>;
      for (const method of ["select", "eq", "in", "like", "order", "single"]) {
        query[method] = (...args: unknown[]) => {
          calls.push({ table, method, args });
          return query;
        };
      }
      return query;
    },
    rpc(name: string, args: unknown) {
      calls.push({ table: name, method: "rpc", args: [args] });
      return Promise.resolve(rpcResult);
    },
  },
}));

const {
  fetchBookingOverview,
  parseRefund,
  recordRefund,
  refundablePayments,
  reviewReasonLabel,
  searchPattern,
} = await import("../src/lib/adminBookings");
const { default: RefundModal } = await import("../src/components/RefundModal");
const { default: AdminBookings } = await import("../src/pages/AdminBookings");
const { default: AdminReviewQueue } = await import("../src/pages/AdminReviewQueue");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  calls.length = 0;
  tableResult = { data: [], error: null };
  tableResults.clear();
  rpcResult = { data: null, error: null };
});

describe("booking overview filters", () => {
  it("sends each chosen filter to the database and searches students by name or email", async () => {
    await fetchBookingOverview({ bookingStatus: "Class Cancelled", paymentState: "paid", material: "printed", search: "  Thandi_ " });
    const filters = calls.filter((call) => call.table === "admin_booking_overview" && call.method !== "select");
    expect(filters.map((call) => [call.method, ...call.args])).toEqual([
      ["eq", "booking_status", "Class Cancelled"],
      ["eq", "payment_state", "paid"],
      ["eq", "material_kind", "printed"],
      ["like", "student_search", "%thandi\\_%"],
      ["order", "created_at", { ascending: false }],
    ]);
  });

  it("sends no filter for All and a blank search", async () => {
    await fetchBookingOverview({ bookingStatus: "", paymentState: "", material: "", search: "   " });
    expect(calls.filter((call) => ["eq", "like"].includes(call.method))).toEqual([]);
    expect(searchPattern("   ")).toBeNull();
  });
});

const paid = (id: string, amount: number) => ({ id, amount, status: "Paid", paidAt: "2026-11-18T08:00:00", ozowTransactionId: null });
const refunded = (id: string, amount: number) => ({ id, amount, status: "Refunded", paidAt: "2026-11-19T08:00:00", ozowTransactionId: null });
const refund = (paymentId: string, amount: number) => ({
  id: `r-${paymentId}-${amount}`, paymentId, amount, reason: "r", externalReference: "x", keepsDocumentAccess: true, recordedAt: "2026-11-19T08:00:00", recordedBy: "Admin",
});

describe("what is still refundable", () => {
  it("subtracts earlier refunds from the payment they returned", () => {
    const detail = { payments: [paid("p1", 250), refunded("l1", 100)], attempts: [], refunds: [refund("p1", 100)] };
    expect(refundablePayments(detail).map(({ payment, refundable }) => [payment.id, refundable])).toEqual([["p1", 150]]);
  });

  it("offers each duplicate payment once and nothing once everything is refunded", () => {
    const twice = { payments: [paid("p1", 100), paid("p2", 100)], attempts: [], refunds: [] };
    expect(refundablePayments(twice).map(({ refundable }) => refundable)).toEqual([100, 100]);
    const done = { payments: [paid("p1", 100), refunded("l1", 100)], attempts: [], refunds: [refund("p1", 100)] };
    expect(refundablePayments(done)).toEqual([]);
  });
});

describe("refund form", () => {
  const draft = { paymentId: "p1", amount: "150", reason: " Student withdrew ", reference: " EFT-77 ", keepsDocumentAccess: false };

  it.each([
    [{ paymentId: "" }, "Choose the payment"],
    [{ amount: "0" }, "Enter the refunded amount"],
    [{ amount: "12.345" }, "Enter the refunded amount"],
    [{ amount: "150.01" }, "At most R 150 is still refundable"],
    [{ reason: "  " }, "Give the reason"],
    [{ reference: "" }, "Give the bank or Ozow reference"],
    [{ keepsDocumentAccess: null }, "Decide whether the student keeps access"],
  ])("refuses %j", (patch, problem) => {
    const result = parseRefund({ ...draft, ...patch }, 150);
    expect("problem" in result && result.problem).toContain(problem);
  });

  it("trims what it sends", () => {
    expect(parseRefund(draft, 150)).toEqual({
      input: { paymentId: "p1", amount: 150, reason: "Student withdrew", reference: "EFT-77", keepsDocumentAccess: false },
    });
  });

  it("explains a reference already used for another refund", async () => {
    rpcResult = { data: null, error: { message: "duplicate", code: "23505" } };
    const error = await recordRefund({ paymentId: "p1", amount: 1, reason: "r", reference: "EFT-77", keepsDocumentAccess: true });
    expect(error).toBe("Reference EFT-77 is already recorded for a different refund. Check the reference.");
    expect(calls[0]).toEqual({
      table: "record_refund",
      method: "rpc",
      args: [{ p_payment_id: "p1", p_amount: 1, p_reason: "r", p_reference: "EFT-77", p_keeps_document_access: true }],
    });
  });
});

describe("review reasons", () => {
  it("labels known reasons and readable fallbacks for new ones", () => {
    expect(reviewReasonLabel("late_payment")).toBe("Late payment");
    expect(reviewReasonLabel("payment_investigation")).toBe("Bank investigating payment");
    expect(reviewReasonLabel("PendingInvestigation")).toBe("Pending Investigation");
  });
});

describe("refund dialog", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onRecord: ReturnType<typeof vi.fn>;
  let onClose: ReturnType<typeof vi.fn>;

  function type(id: string, value: string) {
    const element = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`);
    if (!element) throw new Error(`no #${id}`);
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    act(() => {
      Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, value);
      element.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  async function submit() {
    const record = [...container.querySelectorAll("button")].find((candidate) => candidate.textContent === "Record refund");
    await act(async () => record?.click());
  }

  beforeEach(() => {
    onRecord = vi.fn().mockResolvedValue(null);
    onClose = vi.fn();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <RefundModal heading="Fixture Student" payments={[{ payment: paid("p1", 250), refundable: 250 }]} onClose={onClose} onRecord={onRecord} />,
      );
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("prefills the only payment and its refundable amount", () => {
    expect(container.querySelector<HTMLSelectElement>("#refund-payment")?.value).toBe("p1");
    expect(container.querySelector<HTMLInputElement>("#refund-amount")?.value).toBe("250");
  });

  it("will not record a refund until the admin decides on course documents", async () => {
    type("refund-reason", "Class cancelled");
    type("refund-reference", "EFT-1");
    await submit();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Decide whether the student keeps access to course documents.");
    expect(onRecord).not.toHaveBeenCalled();

    act(() => container.querySelectorAll<HTMLInputElement>('input[name="refund-access"]')[1].click());
    await submit();
    expect(onRecord).toHaveBeenCalledWith({ paymentId: "p1", amount: 250, reason: "Class cancelled", reference: "EFT-1", keepsDocumentAccess: false });
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps the dialog open and shows the database's refusal", async () => {
    onRecord.mockResolvedValue("A refund of R 250.00 is more than the R 0.00 still refundable on this payment");
    type("refund-reason", "Class cancelled");
    type("refund-reference", "EFT-1");
    act(() => container.querySelectorAll<HTMLInputElement>('input[name="refund-access"]')[0].click());
    await submit();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("still refundable");
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("payments under bank investigation", () => {
  let container: HTMLDivElement;
  let root: Root;

  const overviewRow = {
    id: "b-1", created_at: "2026-11-18T08:00:00", booking_status: "Pending", student_name: "Fixture Student", student_email: "s@example.test",
    class_start_date: "2027-03-02", class_status: "scheduled", course_title: "Wound Care", material_name: "Printed",
    total_amount: "250.00", paid_amount: "0", refunded_amount: "0", payment_state: "investigating", documents_withdrawn: false,
  };
  const flag = (id: string, reason: string, resolved: Partial<{ resolved_at: string; resolution_note: string | null }> = {}) => ({
    id, booking_id: "b-1", reason, details: {}, flagged_at: "2026-11-18T09:00:00", resolved_at: null, resolution_note: null, ...resolved,
  });

  async function render(element: React.ReactNode, path: string) {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(<MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>));
    await act(async () => {});
  }

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("shows each Ozow event's reason and holds back refunds while the bank checks a payment", async () => {
    tableResults.set("admin_booking_overview", { data: [overviewRow], error: null });
    tableResults.set("bookings", {
      error: null,
      data: {
        payments: [{ id: "p-1", amount: "250.00", payment_date: "2026-11-18T08:00:00", ozow_transaction_id: null, payment_statuses: { name: "Paid" } }],
        payment_attempts: [{
          id: "a-1", reference: "DA1", amount: "250.00", status: "investigating", created_at: "2026-11-18T08:00:00", expires_at: "2026-11-18T09:00:00",
          payment_events: [
            { ozow_transaction_id: "tx-1", ozow_status: "Pending", ozow_reason: "Pending", outcome: "noted", recorded_at: "2026-11-18T08:01:00" },
            { ozow_transaction_id: "tx-1", ozow_status: "Pending", ozow_reason: "PendingInvestigation", outcome: "investigating", recorded_at: "2026-11-18T08:02:00" },
          ],
        }],
        refunds: [],
      },
    });
    rpcResult = { data: [], error: null };

    await render(<AdminBookings />, "/admin/bookings?open=b-1");

    expect(container.textContent).toContain("Bank investigating");
    expect(container.textContent).toContain("Pending (Pending) → noted");
    expect(container.textContent).toContain("Pending (PendingInvestigation) → investigating");
    expect(container.textContent).toContain("Ozow is checking a payment with the bank. Record refunds once Ozow decides.");
    expect([...container.querySelectorAll("button")].some((button) => button.textContent === "Record refund")).toBe(false);
  });

  it("lets settlement close an investigation flag instead of an admin", async () => {
    tableResults.set("admin_booking_overview", { data: [overviewRow], error: null });
    rpcResult = {
      error: null,
      data: [
        flag("f-1", "payment_investigation"),
        flag("f-2", "late_payment"),
        flag("f-3", "payment_investigation", { resolved_at: "2026-11-18T10:00:00" }),
      ],
    };

    await render(<AdminReviewQueue />, "/admin/review");

    const cards = [...container.querySelectorAll(".flag-card")];
    expect(cards.map((card) => [card.querySelector(".badge")?.textContent, card.querySelector("textarea") !== null])).toEqual([
      ["Bank investigating payment", false],
      ["Late payment", true],
    ]);
    expect(cards[0].textContent).toContain("The flag closes itself when Ozow confirms or fails the payment.");

    const resolvedTab = [...container.querySelectorAll("button")].find((button) => button.textContent?.startsWith("Resolved"));
    await act(async () => resolvedTab?.click());
    expect(container.querySelector(".resolution")?.textContent).toContain("Ozow finished checking the payment, so the flag closed itself.");
  });
});
