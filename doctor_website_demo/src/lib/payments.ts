import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "../supabaseClient";

export type PaymentOutcome = "paid" | "awaiting" | "lapsed" | "closed";

export type BookingPayment = {
  bookingId: string;
  courseId: string | null;
  courseTitle: string;
  total: number;
  expiresAt: string | null;
  outcome: PaymentOutcome;
};

type BookingPaymentRow = {
  id: string;
  booking_status: string;
  total_amount: number | string;
  expires_at: string | null;
  holds_seat: boolean;
  course_sessions: { courses: { id: string; course_title: string } | null } | null;
};

const CHECKOUT_REFUSALS: [fragment: string, message: string][] = [
  ["has expired", "Your seat hold has expired. Book the class again."],
  ["not awaiting payment", "This booking is not awaiting payment."],
  ["belongs to another student", "This booking belongs to another account."],
  ["nothing to pay", "This booking has nothing to pay."],
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

export function paymentOutcome(bookingStatus: string, holdsSeat: boolean): PaymentOutcome {
  if (bookingStatus === "Confirmed" || bookingStatus === "Completed") return "paid";
  if (bookingStatus === "Pending") return holdsSeat ? "awaiting" : "lapsed";
  if (bookingStatus === "Expired") return "lapsed";
  return "closed";
}

export async function fetchBookingPayment(bookingId: string, userId: string): Promise<{ payment: BookingPayment | null; error: string | null }> {
  const { data, error } = await supabase
    .from("bookings")
    .select("id, booking_status, total_amount, expires_at, holds_seat, course_sessions ( courses ( id, course_title ) )")
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
      outcome: paymentOutcome(row.booking_status, row.holds_seat),
    },
    error: null,
  };
}
