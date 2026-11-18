import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PayButton from "../components/PayButton";
import { Skeleton } from "../components/Skeleton";
import { useAuth } from "../context/useAuth";
import { formatHoldExpiry } from "../lib/bookings";
import { fetchBookingPayment, type BookingPayment } from "../lib/payments";

function Outcome({ payment, onRefresh }: { payment: BookingPayment; onRefresh: () => void }) {
  const courseLink = payment.courseId ? `/courses/${payment.courseId}` : "/courses";

  switch (payment.outcome) {
    case "paid":
      return (
        <>
          <h1>Payment received</h1>
          <p>Your seat in {payment.courseTitle} is booked.</p>
          <div className="payment-actions"><Link className="sc-enrol-btn" to="/courses">My courses</Link></div>
        </>
      );
    case "late":
      return (
        <>
          <h1>Payment received</h1>
          <p>
            Ozow confirmed your payment of R {payment.total.toLocaleString()}, but it reached us after your seat hold
            in {payment.courseTitle} ended and we could not confirm a seat automatically. An administrator will contact
            you to place you in the class or refund you.
          </p>
          <div className="payment-actions"><Link className="sc-enrol-btn" to="/courses">My courses</Link></div>
        </>
      );
    case "class_cancelled":
      return (
        <>
          <h1>Payment received</h1>
          <p>
            Ozow confirmed your payment of R {payment.total.toLocaleString()}, but {payment.courseTitle} has been
            cancelled. An administrator will contact you to refund you or move you to another class.
          </p>
          <div className="payment-actions"><Link className="sc-enrol-btn" to="/courses">My courses</Link></div>
        </>
      );
    case "booking_cancelled":
      return (
        <>
          <h1>Payment received</h1>
          <p>
            Ozow confirmed your payment of R {payment.total.toLocaleString()}, but your booking for {payment.courseTitle} was
            cancelled. An administrator will contact you about a refund.
          </p>
          <div className="payment-actions"><Link className="sc-enrol-btn" to="/courses">My courses</Link></div>
        </>
      );
    case "investigating":
      return (
        <>
          <h1>Your bank is checking this payment</h1>
          <p>
            Ozow could not confirm your payment of R {payment.total.toLocaleString()} with your bank straight away, so
            it is checking by hand. No money has been recorded yet.{" "}
            {payment.holdsSeat
              ? `Your seat in ${payment.courseTitle} stays held until the check is finished.`
              : `Your seat in ${payment.courseTitle} is no longer held, so if your bank confirms the payment an administrator will place you in a class or refund you.`}{" "}
            Please don't pay again. An administrator will contact you if anything is needed.
          </p>
          <div className="payment-actions">
            <Link className="sc-enrol-btn" to="/courses">My courses</Link>
            <button className="payment-secondary" type="button" onClick={onRefresh}>Check again</button>
          </div>
        </>
      );
    case "awaiting":
      return (
        <>
          <h1>Payment not confirmed yet</h1>
          <p>
            We mark a booking paid only when Ozow confirms the payment to us directly. If you completed the payment,
            your seat in {payment.courseTitle} will show as booked shortly.
          </p>
          <p>
            If you cancelled or the payment did not go through, your seat stays held
            {payment.expiresAt ? ` until ${formatHoldExpiry(payment.expiresAt)}` : ""}. You can pay R {payment.total.toLocaleString()} before then.
          </p>
          <div className="payment-actions">
            <PayButton bookingId={payment.bookingId} amount={payment.total} />
            <button className="payment-secondary" type="button" onClick={onRefresh}>Check again</button>
          </div>
        </>
      );
    case "failed":
      return (
        <>
          <h1>Payment did not go through</h1>
          <p>Ozow reported the payment as cancelled or failed, so your seat was released. Book the class again to pay.</p>
          <div className="payment-actions"><Link className="sc-enrol-btn" to={courseLink}>Back to the course</Link></div>
        </>
      );
    case "lapsed":
      return (
        <>
          <h1>Your seat hold expired</h1>
          <p>The booking was not paid in time, so the seat was released. Book the class again to pay for it.</p>
          <div className="payment-actions"><Link className="sc-enrol-btn" to={courseLink}>Back to the course</Link></div>
        </>
      );
    case "closed":
      return (
        <>
          <h1>This booking is closed</h1>
          <p>It is no longer awaiting payment.</p>
          <div className="payment-actions"><Link className="sc-enrol-btn" to="/courses">My courses</Link></div>
        </>
      );
  }
}

export default function PaymentReturn() {
  const [params] = useSearchParams();
  const bookingId = params.get("booking");
  const { user } = useAuth();
  const userId = user?.id;
  const [payment, setPayment] = useState<BookingPayment | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!bookingId || !userId) return;
    let cancelled = false;
    void fetchBookingPayment(bookingId, userId).then((result) => {
      if (cancelled) return;
      setPayment(result.payment);
      setError(result.error ?? "");
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [bookingId, userId, reload]);

  return (
    <main className="sc-main">
      <div className="payment-card" aria-live="polite">
        <p className="eyebrow">Payment</p>
        {!bookingId ? (
          <p className="sc-error" role="alert">This link does not name a booking.</p>
        ) : loading ? (
          <>
            <Skeleton width="60%" height={28} style={{ marginBottom: 12 }} />
            <Skeleton width="90%" height={16} />
          </>
        ) : error ? (
          <p className="sc-error" role="alert">{error}</p>
        ) : payment ? (
          <Outcome payment={payment} onRefresh={() => setReload((count) => count + 1)} />
        ) : (
          <p className="sc-error" role="alert">We could not find this booking on your account.</p>
        )}
      </div>
    </main>
  );
}
