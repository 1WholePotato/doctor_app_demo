import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "../supabaseClient";

export type PaymentOutcome =
  | "paid"
  | "late"
  | "class_cancelled"
  | "booking_cancelled"
  | "investigating"
  | "awaiting"
  | "failed"
  | "lapsed"
  | "closed";

export type BookingPayment = {
  bookingId: string;
  courseId: string | null;
  courseTitle: string;
  total: number;
  expiresAt: string | null;
  holdsSeat: boolean;
  outcome: PaymentOutcome;
};

type BookingPaymentRow = {
  id: string;
  booking_status: string;
  total_amount: number | string;
  expires_at: string | null;
  holds_seat: boolean;
  payment_attempts: { status: string }[] | null;
  course_sessions: { courses: { id: string; course_title: string } | null } | null;
};

const CHECKOUT_REFUSALS: [fragment: string, message: string][] = [
  ["has expired", "Your seat hold has expired. Book the class again."],
  ["not awaiting payment", "This booking is not awaiting payment."],
  ["belongs to another student", "This booking belongs to another account."],
  ["nothing to pay", "This booking has nothing to pay."],
  ["under investigation", "Your earlier payment is still being checked with your bank. Please don't pay again."],
  ["not available yet", "Online payment is not available yet."],
];

async function checkoutRefusal(error: unknown): Promise<string> {
  const body = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null;
  const message = typeof body?.error === "string" ? body.error : "";
  return CHECKOUT_REFUSALS.find(([fragment]) => message.includes(fragment))?.[1] ?? "Could not start the payment. Try again.";
}

export async function startPayment(bookingId: string): Promise<{ url: string; error: null } | { url: null; error: string }> {
  const { data, error } = await supabase.functions.invoke<{ url: string }>("ozow-checkout", { body: { bookingId } });
  if (!error && data?.url) return { url: data.url, error: null };
  return { url: null, error: await checkoutRefusal(error) };
}

export type BookingPaymentState = {
  bookingStatus: string;
  holdsSeat: boolean;
  expiresAt: string | null;
  attemptStatuses: string[];
};

const PAID_WITHOUT_SEAT: Record<string, PaymentOutcome> = {
  "Class Cancelled": "class_cancelled",
  Cancelled: "booking_cancelled",
};

export function paymentOutcome({ bookingStatus, holdsSeat, expiresAt, attemptStatuses }: BookingPaymentState, now = Date.now()): PaymentOutcome {
  if (bookingStatus === "Confirmed" || bookingStatus === "Completed") return "paid";
  if (attemptStatuses.includes("investigating")) return "investigating";
  if (attemptStatuses.includes("paid")) return PAID_WITHOUT_SEAT[bookingStatus] ?? "late";
  if (bookingStatus === "Pending") return holdsSeat ? "awaiting" : "lapsed";
  if (bookingStatus === "Expired") return expiresAt === null || Date.parse(expiresAt) > now ? "failed" : "lapsed";
  return "closed";
}

export async function fetchBookingPayment(bookingId: string, userId: string): Promise<{ payment: BookingPayment | null; error: string | null }> {
  const { data, error } = await supabase
    .from("bookings")
    .select("id, booking_status, total_amount, expires_at, holds_seat, payment_attempts ( status ), course_sessions ( courses ( id, course_title ) )")
    .eq("id", bookingId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { payment: null, error: error.message };
  if (!data) return { payment: null, error: null };
  const row = data as unknown as BookingPaymentRow;
  const course = row.course_sessions?.courses ?? null;
  return {
    payment: {
      bookingId: row.id,
      courseId: course?.id ?? null,
      courseTitle: course?.course_title ?? "your class",
      total: Number(row.total_amount),
      expiresAt: row.expires_at,
      holdsSeat: row.holds_seat,
      outcome: paymentOutcome({
        bookingStatus: row.booking_status,
        holdsSeat: row.holds_seat,
        expiresAt: row.expires_at,
        attemptStatuses: (row.payment_attempts ?? []).map((attempt) => attempt.status),
      }),
    },
    error: null,
  };
}
