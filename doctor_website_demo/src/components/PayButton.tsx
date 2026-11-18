import { useState } from "react";
import { startPayment } from "../lib/payments";

export default function PayButton({ bookingId, amount }: { bookingId: string; amount: number }) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const pay = async () => {
    setStarting(true);
    setError("");
    const result = await startPayment(bookingId);
    if (result.error !== null) {
      setError(result.error);
      setStarting(false);
      return;
    }
    window.location.assign(result.url);
  };

  return (
    <span className="pay-action">
      <button className="book-btn" type="button" disabled={starting} onClick={() => void pay()}>
        {starting ? "Opening Ozow…" : `Pay R ${amount.toLocaleString()}`}
      </button>
      {error && <span className="pay-error" role="alert">{error}</span>}
    </span>
  );
}
