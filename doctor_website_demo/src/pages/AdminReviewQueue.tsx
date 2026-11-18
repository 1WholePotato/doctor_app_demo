import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import {
  fetchClassCancelledAwaitingRefund,
  fetchOverviewRows,
  fetchReviewFlags,
  formatDate,
  formatDateTime,
  formatRand,
  resolveReviewFlag,
  reviewReasonLabel,
  type BookingOverviewRow,
  type ReviewFlag,
} from "../lib/adminBookings";
import "../styles/adminBookings.css";

function flagSummary(details: Record<string, unknown>): string {
  return Object.entries(details)
    .filter(([, value]) => value !== null && typeof value !== "object")
    .map(([key, value]) => `${key.replace(/_/g, " ")}: ${String(value)}`)
    .join(" · ");
}

function ResolveForm({ flag, onResolved }: { flag: ReviewFlag; onResolved: () => Promise<void> }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async () => {
    if (pending) return;
    if (!note.trim()) {
      setError("Write a note saying how this was resolved.");
      return;
    }
    setPending(true);
    const resolveError = await resolveReviewFlag(flag.id, note);
    setPending(false);
    if (resolveError) setError(resolveError);
    else await onResolved();
  };

  return (
    <div className="resolve-form">
      <label htmlFor={`resolve-${flag.id}`} className="readonly-label">Resolution note</label>
      <textarea id={`resolve-${flag.id}`} value={note} onChange={(e) => { setNote(e.target.value); setError(""); }} />
      {error && <span className="field-error" role="alert"><AlertCircle />{error}</span>}
      <button type="button" className="btn-primary" onClick={submit} disabled={pending}>{pending ? "Resolving…" : "Mark resolved"}</button>
    </div>
  );
}

export default function AdminReviewQueue() {
  const [flags, setFlags] = useState<ReviewFlag[]>([]);
  const [bookings, setBookings] = useState<Map<string, BookingOverviewRow>>(new Map());
  const [awaitingRefund, setAwaitingRefund] = useState<BookingOverviewRow[]>([]);
  const [showResolved, setShowResolved] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [review, cancelled] = await Promise.all([fetchReviewFlags(), fetchClassCancelledAwaitingRefund()]);
    const overview = await fetchOverviewRows([...new Set(review.flags.map((flag) => flag.bookingId))]);
    setFlags(review.flags);
    setBookings(new Map(overview.rows.map((row) => [row.id, row])));
    setAwaitingRefund(cancelled.rows);
    setLoadError([review.error, cancelled.error, overview.error].filter(Boolean).join(" "));
    setLoading(false);
  }, []);

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

  const shown = flags.filter((flag) => (showResolved ? flag.resolvedAt : !flag.resolvedAt));
  const openCount = flags.filter((flag) => !flag.resolvedAt).length;

  return (
    <main className="ac-main">
      <div className="ac-header">
        <div className="ac-header-left">
          <p className="eyebrow">Payments</p>
          <h1>Review queue</h1>
        </div>
      </div>

      {loadError && <p className="load-error"><AlertCircle />{loadError}</p>}

      <div className="filter-pills">
        <button type="button" className={`filter-pill${showResolved ? "" : " active"}`} onClick={() => setShowResolved(false)}>Open ({openCount})</button>
        <button type="button" className={`filter-pill${showResolved ? " active" : ""}`} onClick={() => setShowResolved(true)}>Resolved ({flags.length - openCount})</button>
      </div>

      {loading ? <p className="table-empty">Loading the review queue…</p> : shown.length === 0 ? (
        <p className="table-empty">{showResolved ? "No resolved flags yet." : "Nothing to review."}</p>
      ) : (
        <div className="flag-cards">
          {shown.map((flag) => {
            const booking = bookings.get(flag.bookingId);
            return (
              <article key={flag.id} className="flag-card">
                <div className="flag-card-head">
                  <span className="badge badge-pending">{reviewReasonLabel(flag.reason)}</span>
                  <span className="muted-dash">flagged {formatDateTime(flag.flaggedAt)}</span>
                </div>
                {booking ? (
                  <p>
                    <strong>{booking.studentName}</strong> · {booking.courseTitle ?? "Not linked to a class"}
                    {booking.classStartDate ? ` · ${formatDate(booking.classStartDate)}` : ""} · {booking.bookingStatus} · paid {formatRand(booking.paidAmount)}
                  </p>
                ) : <p>Booking {flag.bookingId}</p>}
                <p className="readonly-sub">{flagSummary(flag.details)}</p>
                <Link to={`/admin/bookings?open=${flag.bookingId}`}>Open booking and payments</Link>
                {flag.resolvedAt ? (
                  <p className="resolution">Resolved {formatDateTime(flag.resolvedAt)}: {flag.resolutionNote}</p>
                ) : (
                  <ResolveForm flag={flag} onResolved={load} />
                )}
              </article>
            );
          })}
        </div>
      )}

      <div className="section-header">
        <p className="section-title">Cancelled classes awaiting refund</p>
      </div>
      <div className="table-card">
        {awaitingRefund.length === 0 ? <p className="table-empty">Every paid booking on a cancelled class has been refunded.</p> : (
          <table className="table-inner">
            <thead><tr><th>Student</th><th>Class</th><th>Paid</th><th>Refunded</th><th /></tr></thead>
            <tbody>
              {awaitingRefund.map((row) => (
                <tr key={row.id}>
                  <td>{row.studentName}</td>
                  <td>{row.courseTitle} · {row.classStartDate ? formatDate(row.classStartDate) : ""}</td>
                  <td>{formatRand(row.paidAmount)}</td>
                  <td>{formatRand(row.refundedAmount)}</td>
                  <td><Link to={`/admin/bookings?open=${row.id}`}>Refund</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
