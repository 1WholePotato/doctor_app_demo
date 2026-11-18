import { supabase } from "../supabaseClient";

export type PaymentState = "refunded" | "partly_refunded" | "paid" | "awaiting" | "unpaid";

export const PAYMENT_STATE_LABEL: Record<PaymentState, string> = {
  paid: "Paid",
  partly_refunded: "Partly refunded",
  refunded: "Refunded",
  awaiting: "Awaiting Ozow",
  unpaid: "Not paid",
};

export const BOOKING_STATUSES = ["Pending", "Confirmed", "Completed", "Cancelled", "Class Cancelled", "Expired"] as const;

export type MaterialKind = "electronic" | "printed";

export type BookingFilters = {
  bookingStatus: string;
  paymentState: PaymentState | "";
  material: MaterialKind | "";
  search: string;
};

export const NO_FILTERS: BookingFilters = { bookingStatus: "", paymentState: "", material: "", search: "" };

export type BookingOverviewRow = {
  id: string;
  createdAt: string;
  bookingStatus: string;
  holdsSeat: boolean;
  expiresAt: string | null;
  studentName: string;
  studentEmail: string;
  classStartDate: string | null;
  classStatus: string | null;
  courseTitle: string | null;
  materialName: string | null;
  materialKind: MaterialKind | null;
  totalAmount: number;
  paidAmount: number;
  refundedAmount: number;
  paymentState: PaymentState;
  documentsWithdrawn: boolean;
};

type OverviewRecord = {
  id: string;
  created_at: string;
  booking_status: string;
  holds_seat: boolean;
  expires_at: string | null;
  student_name: string;
  student_email: string;
  class_start_date: string | null;
  class_status: string | null;
  course_title: string | null;
  material_name: string | null;
  material_kind: MaterialKind | null;
  total_amount: number | string;
  paid_amount: number | string;
  refunded_amount: number | string;
  payment_state: PaymentState;
  documents_withdrawn: boolean;
};

const OVERVIEW_COLUMNS =
  "id, created_at, booking_status, holds_seat, expires_at, student_name, student_email, class_start_date, class_status, course_title, material_name, material_kind, total_amount, paid_amount, refunded_amount, payment_state, documents_withdrawn";

function toOverviewRow(record: OverviewRecord): BookingOverviewRow {
  return {
    id: record.id,
    createdAt: record.created_at,
    bookingStatus: record.booking_status,
    holdsSeat: record.holds_seat,
    expiresAt: record.expires_at,
    studentName: record.student_name,
    studentEmail: record.student_email,
    classStartDate: record.class_start_date,
    classStatus: record.class_status,
    courseTitle: record.course_title,
    materialName: record.material_name,
    materialKind: record.material_kind,
    totalAmount: Number(record.total_amount),
    paidAmount: Number(record.paid_amount),
    refundedAmount: Number(record.refunded_amount),
    paymentState: record.payment_state,
    documentsWithdrawn: record.documents_withdrawn,
  };
}

export function searchPattern(search: string): string | null {
  const words = search.trim().toLowerCase().replace(/[%_\\]/g, (c) => `\\${c}`);
  return words ? `%${words}%` : null;
}

export async function fetchBookingOverview(filters: BookingFilters): Promise<{ rows: BookingOverviewRow[]; error: string | null }> {
  let query = supabase.from("admin_booking_overview").select(OVERVIEW_COLUMNS);
  if (filters.bookingStatus) query = query.eq("booking_status", filters.bookingStatus);
  if (filters.paymentState) query = query.eq("payment_state", filters.paymentState);
  if (filters.material) query = query.eq("material_kind", filters.material);
  const pattern = searchPattern(filters.search);
  if (pattern) query = query.like("student_search", pattern);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) return { rows: [], error: error.message };
  return { rows: (data as OverviewRecord[]).map(toOverviewRow), error: null };
}

export async function fetchClassCancelledAwaitingRefund(): Promise<{ rows: BookingOverviewRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from("admin_booking_overview")
    .select(OVERVIEW_COLUMNS)
    .eq("booking_status", "Class Cancelled")
    .in("payment_state", ["paid", "partly_refunded"])
    .order("class_start_date");
  if (error) return { rows: [], error: error.message };
  return { rows: (data as OverviewRecord[]).map(toOverviewRow), error: null };
}

export type PaymentRow = {
  id: string;
  amount: number;
  status: string;
  paidAt: string | null;
  ozowTransactionId: string | null;
};

export type PaymentEventRow = {
  ozowTransactionId: string;
  ozowStatus: string;
  outcome: string;
  recordedAt: string;
};

export type PaymentAttemptRow = {
  id: string;
  reference: string;
  amount: number;
  status: string;
  createdAt: string;
  expiresAt: string;
  events: PaymentEventRow[];
};

export type RefundRow = {
  id: string;
  paymentId: string;
  amount: number;
  reason: string;
  externalReference: string;
  keepsDocumentAccess: boolean;
  recordedAt: string;
  recordedBy: string;
};

export type BookingDetail = {
  payments: PaymentRow[];
  attempts: PaymentAttemptRow[];
  refunds: RefundRow[];
};

type DetailRecord = {
  payments: { id: string; amount: number | string; payment_date: string | null; ozow_transaction_id: string | null; payment_statuses: { name: string } | null }[];
  payment_attempts: {
    id: string;
    reference: string;
    amount: number | string;
    status: string;
    created_at: string;
    expires_at: string;
    payment_events: { ozow_transaction_id: string; ozow_status: string; outcome: string; recorded_at: string }[];
  }[];
  refunds: {
    id: string;
    payment_id: string;
    amount: number | string;
    reason: string;
    external_reference: string;
    keeps_document_access: boolean;
    recorded_at: string;
    users: { first_name: string; last_name: string } | null;
  }[];
};

const DETAIL_COLUMNS = `payments ( id, amount, payment_date, ozow_transaction_id, payment_statuses ( name ) ),
  payment_attempts ( id, reference, amount, status, created_at, expires_at, payment_events ( ozow_transaction_id, ozow_status, outcome, recorded_at ) ),
  refunds ( id, payment_id, amount, reason, external_reference, keeps_document_access, recorded_at, users ( first_name, last_name ) )`;

const byTime = <T,>(key: (row: T) => string | null) => (a: T, b: T) => (key(a) ?? "").localeCompare(key(b) ?? "");

export async function fetchBookingDetail(bookingId: string): Promise<{ detail: BookingDetail | null; error: string | null }> {
  const { data, error } = await supabase.from("bookings").select(DETAIL_COLUMNS).eq("id", bookingId).single();
  if (error) return { detail: null, error: error.message };
  const record = data as unknown as DetailRecord;
  return {
    detail: {
      payments: record.payments
        .map((payment) => ({
          id: payment.id,
          amount: Number(payment.amount),
          status: payment.payment_statuses?.name ?? "Unknown",
          paidAt: payment.payment_date,
          ozowTransactionId: payment.ozow_transaction_id,
        }))
        .sort(byTime((payment) => payment.paidAt)),
      attempts: record.payment_attempts
        .map((attempt) => ({
          id: attempt.id,
          reference: attempt.reference,
          amount: Number(attempt.amount),
          status: attempt.status,
          createdAt: attempt.created_at,
          expiresAt: attempt.expires_at,
          events: attempt.payment_events
            .map((event) => ({
              ozowTransactionId: event.ozow_transaction_id,
              ozowStatus: event.ozow_status,
              outcome: event.outcome,
              recordedAt: event.recorded_at,
            }))
            .sort(byTime((event) => event.recordedAt)),
        }))
        .sort(byTime((attempt) => attempt.createdAt)),
      refunds: record.refunds
        .map((refund) => ({
          id: refund.id,
          paymentId: refund.payment_id,
          amount: Number(refund.amount),
          reason: refund.reason,
          externalReference: refund.external_reference,
          keepsDocumentAccess: refund.keeps_document_access,
          recordedAt: refund.recorded_at,
          recordedBy: refund.users ? `${refund.users.first_name} ${refund.users.last_name}` : "Unknown admin",
        }))
        .sort(byTime((refund) => refund.recordedAt)),
    },
    error: null,
  };
}

export type RefundablePayment = { payment: PaymentRow; refundable: number };

const cents = (amount: number) => Math.round(amount * 100);

export function refundablePayments(detail: BookingDetail): RefundablePayment[] {
  const bookingLeft = cents(
    detail.payments.reduce((sum, payment) => sum + (payment.status === "Paid" ? payment.amount : payment.status === "Refunded" ? -payment.amount : 0), 0),
  );
  return detail.payments
    .filter((payment) => payment.status === "Paid")
    .map((payment) => {
      const refunded = detail.refunds.filter((refund) => refund.paymentId === payment.id).reduce((sum, refund) => sum + cents(refund.amount), 0);
      return { payment, refundable: Math.max(0, Math.min(cents(payment.amount) - refunded, bookingLeft)) / 100 };
    })
    .filter(({ refundable }) => refundable > 0);
}

export type RefundDraft = {
  paymentId: string;
  amount: string;
  reason: string;
  reference: string;
  keepsDocumentAccess: boolean | null;
};

export type RefundInput = {
  paymentId: string;
  amount: number;
  reason: string;
  reference: string;
  keepsDocumentAccess: boolean;
};

export function parseRefund(draft: RefundDraft, refundable: number): { input: RefundInput } | { problem: string } {
  if (!draft.paymentId) return { problem: "Choose the payment this refund returns." };
  const amount = Number(draft.amount);
  if (!/^\d+(\.\d{1,2})?$/.test(draft.amount.trim()) || !(amount > 0)) return { problem: "Enter the refunded amount in rand, for example 150 or 99.50." };
  if (cents(amount) > cents(refundable)) return { problem: `At most ${formatRand(refundable)} is still refundable on this payment.` };
  if (!draft.reason.trim()) return { problem: "Give the reason for this refund." };
  if (!draft.reference.trim()) return { problem: "Give the bank or Ozow reference of the refund you made." };
  if (draft.keepsDocumentAccess === null) return { problem: "Decide whether the student keeps access to course documents." };
  return {
    input: {
      paymentId: draft.paymentId,
      amount,
      reason: draft.reason.trim(),
      reference: draft.reference.trim(),
      keepsDocumentAccess: draft.keepsDocumentAccess,
    },
  };
}

export async function recordRefund(input: RefundInput): Promise<string | null> {
  const { error } = await supabase.rpc("record_refund", {
    p_payment_id: input.paymentId,
    p_amount: input.amount,
    p_reason: input.reason,
    p_reference: input.reference,
    p_keeps_document_access: input.keepsDocumentAccess,
  });
  if (!error) return null;
  if (error.code === "23505") return `Reference ${input.reference} is already recorded for a different refund. Check the reference.`;
  return error.message;
}

export type ReviewFlag = {
  id: string;
  bookingId: string;
  reason: string;
  details: Record<string, unknown>;
  flaggedAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
};

type ReviewFlagRecord = {
  id: string;
  booking_id: string;
  reason: string;
  details: Record<string, unknown>;
  flagged_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
};

const REVIEW_REASON_LABEL: Record<string, string> = {
  late_payment: "Late payment",
  duplicate_payment: "Duplicate payment",
  payment_mismatch: "Payment mismatch",
  ambiguous_session: "Class unknown",
  duplicate_active_booking: "Duplicate booking",
  unverified_payment_status: "Unverified payment status",
};

export function reviewReasonLabel(reason: string): string {
  return REVIEW_REASON_LABEL[reason] ?? reason.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export async function fetchReviewFlags(): Promise<{ flags: ReviewFlag[]; error: string | null }> {
  const { data, error } = await supabase.rpc("review_flags");
  if (error) return { flags: [], error: error.message };
  return {
    flags: (data as ReviewFlagRecord[]).map((flag) => ({
      id: flag.id,
      bookingId: flag.booking_id,
      reason: flag.reason,
      details: flag.details,
      flaggedAt: flag.flagged_at,
      resolvedAt: flag.resolved_at,
      resolutionNote: flag.resolution_note,
    })),
    error: null,
  };
}

export async function resolveReviewFlag(flagId: string, note: string): Promise<string | null> {
  const { error } = await supabase.rpc("resolve_review_flag", { p_flag_id: flagId, p_note: note });
  return error ? error.message : null;
}

export async function fetchOverviewRows(bookingIds: string[]): Promise<{ rows: BookingOverviewRow[]; error: string | null }> {
  if (bookingIds.length === 0) return { rows: [], error: null };
  const { data, error } = await supabase.from("admin_booking_overview").select(OVERVIEW_COLUMNS).in("id", bookingIds);
  if (error) return { rows: [], error: error.message };
  return { rows: (data as OverviewRecord[]).map(toOverviewRow), error: null };
}

export type PrintedDemandRow = {
  classId: string;
  courseId: string;
  courseTitle: string;
  startDate: string;
  startTime: string;
  locationName: string;
  confirmed: number;
  held: number;
  booksNeeded: number;
};

type PrintedDemandRecord = {
  course_session_id: string;
  course_id: string;
  course_title: string;
  start_date: string;
  start_time: string;
  location_name: string;
  confirmed: number;
  held: number;
  books_needed: number;
};

export async function fetchPrintedDemand(): Promise<{ rows: PrintedDemandRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from("printed_material_demand")
    .select("course_session_id, course_id, course_title, start_date, start_time, location_name, confirmed, held, books_needed")
    .order("start_date")
    .order("start_time");
  if (error) return { rows: [], error: error.message };
  return {
    rows: (data as PrintedDemandRecord[]).map((row) => ({
      classId: row.course_session_id,
      courseId: row.course_id,
      courseTitle: row.course_title,
      startDate: row.start_date,
      startTime: row.start_time.slice(0, 5),
      locationName: row.location_name,
      confirmed: row.confirmed,
      held: row.held,
      booksNeeded: row.books_needed,
    })),
    error: null,
  };
}

export function formatRand(amount: number): string {
  return `R ${amount.toLocaleString("en-ZA", { minimumFractionDigits: amount % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(value: string): string {
  return new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-ZA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
