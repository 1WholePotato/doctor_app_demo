// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BookingPayment, PaymentOutcome } from "../src/lib/payments";

let payment: BookingPayment | null = null;

vi.mock("../src/context/useAuth", () => ({ useAuth: () => ({ user: { id: "student-1" } }) }));
vi.mock("../src/lib/payments", () => ({
  fetchBookingPayment: () => Promise.resolve({ payment, error: null }),
  startPayment: () => Promise.resolve({ url: null, error: "not in this test" }),
}));

const { default: PaymentReturn } = await import("../src/pages/PaymentReturn");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function shown(outcome: PaymentOutcome, holdsSeat = true): Promise<string> {
  payment = { bookingId: "booking-1", courseId: "course-1", courseTitle: "Wound Care", total: 250, expiresAt: null, holdsSeat, outcome };
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={["/payments/return?booking=booking-1"]}>
        <PaymentReturn />
      </MemoryRouter>,
    );
  });
  return container.textContent ?? "";
}

describe("payment return page", () => {
  it("tells a student whose payment arrived after the hold that an admin will place or refund them", async () => {
    const text = await shown("late");
    expect(text).toContain("reached us after your seat hold in Wound Care ended");
    expect(text).not.toContain("cancelled");
  });

  it("tells a student who paid on time for a class later cancelled that the class was cancelled", async () => {
    const text = await shown("class_cancelled");
    expect(text).toContain("Ozow confirmed your payment of R 250, but Wound Care has been cancelled");
    expect(text).not.toContain("seat hold");
  });

  it("tells a student whose booking was cancelled after payment that a refund follows", async () => {
    const text = await shown("booking_cancelled");
    expect(text).toContain("your booking for Wound Care was cancelled");
    expect(text).not.toContain("seat hold");
  });

  it("tells a student whose payment is under investigation that the seat is held and not to pay again", async () => {
    const text = await shown("investigating");
    expect(text).toContain("Your bank is checking this payment");
    expect(text).toContain("No money has been recorded yet");
    expect(text).toContain("Your seat in Wound Care stays held");
    expect(text).toContain("Please don't pay again");
    expect(container.querySelector("button")?.textContent).toBe("Check again");
  });

  it("does not promise a seat while a payment is under investigation after the seat was released", async () => {
    const text = await shown("investigating", false);
    expect(text).toContain("Your bank is checking this payment");
    expect(text).toContain("Your seat in Wound Care is no longer held");
    expect(text).not.toContain("stays held");
    expect(text).toContain("Please don't pay again");
  });
});
