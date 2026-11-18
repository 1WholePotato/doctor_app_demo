import { Fragment, useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertCircle, ChevronDown, ChevronRight, ReceiptText } from "lucide-react";
import RefundModal from "../components/RefundModal";
import {
  BOOKING_STATUSES,
  NO_FILTERS,
  PAYMENT_STATE_LABEL,
  fetchBookingDetail,
  fetchBookingOverview,
  fetchReviewFlags,
  formatDate,
  formatDateTime,
  formatRand,
  recordRefund,
  refundablePayments,
  reviewReasonLabel,
  type BookingDetail,
  type BookingFilters,
  type BookingOverviewRow,
  type MaterialKind,
  type PaymentState,
  type ReviewFlag,
} from "../lib/adminBookings";
import "../styles/adminBookings.css";

const PAYMENT_BADGE: Record<PaymentState, string> = {
  paid: "badge-paid",
  partly_refunded: "badge-pending",
  refunded: "badge-muted",
  awaiting: "badge-pending",
  unpaid: "badge-muted",
};

function BookingDetailPanel({
  booking,
  flags,
  onChanged,
}: {
  booking: BookingOverviewRow;
  flags: ReviewFlag[];
  onChanged: () => Promise<void>;
}) {
  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [error, setError] = useState("");
  const [refunding, setRefunding] = useState(false);

  const load = useCallback(async () => {
    const result = await fetchBookingDetail(booking.id);
    setDetail(result.detail);
    setError(result.error ?? "");
  }, [booking.id]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (error) return <p className="load-error"><AlertCircle />{error}</p>;
  if (!detail) return <p className="readonly-sub">Loading payments…</p>;

  const refundable = refundablePayments(detail);

  return (
    <div className="booking-detail">
      <div className="booking-detail-head">
        <p className="readonly-sub">
          Course {formatRand(booking.totalAmount)} · Paid {formatRand(booking.paidAmount)} · Refunded {formatRand(booking.refundedAmount)}
          {booking.documentsWithdrawn ? " · Course documents withdrawn" : ""}
        </p>
        {refundable.length > 0 && (
          <button type="button" className="btn-primary" onClick={() => setRefunding(true)}><ReceiptText />Record refund</button>
        )}
      </div>

      <section>
        <p className="detail-title">Payments</p>
        {detail.payments.length === 0 ? <p className="readonly-sub">No payments recorded.</p> : (
          <table className="detail-table">
            <thead><tr><th>Status</th><th>Amount</th><th>Date</th><th>Ozow transaction</th></tr></thead>
            <tbody>
              {detail.payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.status}</td>
                  <td>{formatRand(payment.amount)}</td>
                  <td>{payment.paidAt ? formatDateTime(payment.paidAt) : "—"}</td>
                  <td className="mono">{payment.ozowTransactionId ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <p className="detail-title">Ozow payment attempts</p>
        {detail.attempts.length === 0 ? <p className="readonly-sub">The student has not started an Ozow payment.</p> : (
          <table className="detail-table">
            <thead><tr><th>Reference</th><th>Amount</th><th>Status</th><th>Started</th><th>Ozow events</th></tr></thead>
            <tbody>
              {detail.attempts.map((attempt) => (
                <tr key={attempt.id}>
                  <td className="mono">{attempt.reference}</td>
                  <td>{formatRand(attempt.amount)}</td>
                  <td>{attempt.status}</td>
                  <td>{formatDateTime(attempt.createdAt)}</td>
                  <td>
                    {attempt.events.length === 0 ? "None" : attempt.events.map((event) => (
                      <div key={`${event.ozowTransactionId}-${event.ozowStatus}`}>
                        {event.ozowStatus} → {event.outcome} <span className="muted-dash">{formatDateTime(event.recordedAt)}</span>
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <p className="detail-title">Refunds</p>
        {detail.refunds.length === 0 ? <p className="readonly-sub">No refunds recorded.</p> : (
          <table className="detail-table">
            <thead><tr><th>Amount</th><th>Reason</th><th>Reference</th><th>Course documents</th><th>Recorded</th></tr></thead>
            <tbody>
              {detail.refunds.map((refund) => (
                <tr key={refund.id}>
                  <td>{formatRand(refund.amount)}</td>
                  <td>{refund.reason}</td>
                  <td className="mono">{refund.externalReference}</td>
                  <td>{refund.keepsDocumentAccess ? "Keeps access" : "Access withdrawn"}</td>
                  <td>{formatDateTime(refund.recordedAt)} by {refund.recordedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <p className="detail-title">Review flags</p>
        {flags.length === 0 ? <p className="readonly-sub">No review flags.</p> : (
          <ul className="flag-list">
            {flags.map((flag) => (
              <li key={flag.id}>
                <strong>{reviewReasonLabel(flag.reason)}</strong> flagged {formatDateTime(flag.flaggedAt)} ·{" "}
                {flag.resolvedAt ? `resolved ${formatDateTime(flag.resolvedAt)}: ${flag.resolutionNote}` : <Link to="/admin/review">open in the review queue</Link>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {refunding && (
        <RefundModal
          heading={`${booking.studentName} · ${booking.courseTitle ?? "Unlinked booking"}`}
          payments={refundable}
          onClose={() => setRefunding(false)}
          onRecord={async (input) => {
            const refundError = await recordRefund(input);
            if (!refundError) {
              await load();
              await onChanged();
            }
            return refundError;
          }}
        />
      )}
    </div>
  );
}

export default function AdminBookings() {
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<BookingFilters>(NO_FILTERS);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<BookingOverviewRow[]>([]);
  const [flags, setFlags] = useState<ReviewFlag[]>([]);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(searchParams.get("open"));

  const load = useCallback(async () => {
    const [overview, review] = await Promise.all([fetchBookingOverview(filters), fetchReviewFlags()]);
    setRows(overview.rows);
    setFlags(review.flags);
    setLoadError([overview.error, review.error].filter(Boolean).join(" "));
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    const timer = setTimeout(() => setFilters((current) => (current.search === search ? current : { ...current, search })), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const openFlags = (bookingId: string) => flags.filter((flag) => flag.bookingId === bookingId && !flag.resolvedAt).length;

  return (
    <main className="ac-main">
      <div className="ac-header">
        <div className="ac-header-left">
          <p className="eyebrow">Payments</p>
          <h1>Bookings</h1>
        </div>
      </div>

      <div className="booking-filters">
        <div className="field">
          <label htmlFor="filter-booking-status">Booking status</label>
          <select id="filter-booking-status" value={filters.bookingStatus} onChange={(e) => setFilters({ ...filters, bookingStatus: e.target.value })}>
            <option value="">All</option>
            {BOOKING_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-payment">Payment</label>
          <select id="filter-payment" value={filters.paymentState} onChange={(e) => setFilters({ ...filters, paymentState: e.target.value as PaymentState | "" })}>
            <option value="">All</option>
            {(Object.keys(PAYMENT_STATE_LABEL) as PaymentState[]).map((state) => <option key={state} value={state}>{PAYMENT_STATE_LABEL[state]}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-material">Material</label>
          <select id="filter-material" value={filters.material} onChange={(e) => setFilters({ ...filters, material: e.target.value as MaterialKind | "" })}>
            <option value="">All</option>
            <option value="electronic">Electronic</option>
            <option value="printed">Printed</option>
          </select>
        </div>
        <div className="field booking-search">
          <label htmlFor="filter-search">Student</label>
          <input id="filter-search" type="search" placeholder="Name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {loadError && <p className="load-error"><AlertCircle />{loadError}</p>}

      <div className="table-card">
        {loading ? <p className="table-empty">Loading bookings…</p> : rows.length === 0 ? (
          <p className="table-empty">No bookings match these filters.</p>
        ) : (
          <table className="table-inner bookings-table">
            <thead>
              <tr>
                <th aria-label="Expand" />
                <th>Student</th>
                <th>Class</th>
                <th>Material</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Booked</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const open = openId === row.id;
                const flagged = openFlags(row.id);
                return (
                  <Fragment key={row.id}>
                    <tr className={open ? "row-open" : undefined} onClick={() => setOpenId(open ? null : row.id)}>
                      <td>
                        <button type="button" className="row-toggle" aria-expanded={open} aria-label={open ? "Hide payments" : "Show payments"}>
                          {open ? <ChevronDown /> : <ChevronRight />}
                        </button>
                      </td>
                      <td>
                        <div>{row.studentName}</div>
                        <div className="muted-dash">{row.studentEmail}</div>
                      </td>
                      <td>
                        <div>{row.courseTitle ?? "Not linked to a class"}</div>
                        <div className="muted-dash">
                          {row.classStartDate ? formatDate(row.classStartDate) : ""}
                          {row.classStatus === "cancelled" ? " · class cancelled" : ""}
                        </div>
                      </td>
                      <td>{row.materialName ?? "—"}</td>
                      <td>{formatRand(row.totalAmount)}</td>
                      <td>
                        <span className={`badge ${PAYMENT_BADGE[row.paymentState]}`}><span className="badge-dot" />{PAYMENT_STATE_LABEL[row.paymentState]}</span>
                        {flagged > 0 && <div className="flag-note">{flagged === 1 ? "1 open review flag" : `${flagged} open review flags`}</div>}
                      </td>
                      <td>{row.bookingStatus}</td>
                      <td className="muted-dash">{formatDate(row.createdAt)}</td>
                    </tr>
                    {open && (
                      <tr className="row-detail">
                        <td colSpan={8}>
                          <BookingDetailPanel booking={row} flags={flags.filter((flag) => flag.bookingId === row.id)} onChanged={load} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
