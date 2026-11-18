import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { ModalShell } from "./ClassModals";
import { formatDateTime, formatRand, parseRefund, type RefundablePayment, type RefundDraft, type RefundInput } from "../lib/adminBookings";

export default function RefundModal({
  heading,
  payments,
  onClose,
  onRecord,
}: {
  heading: string;
  payments: RefundablePayment[];
  onClose: () => void;
  onRecord: (input: RefundInput) => Promise<string | null>;
}) {
  const [draft, setDraft] = useState<RefundDraft>({
    paymentId: payments.length === 1 ? payments[0].payment.id : "",
    amount: payments.length === 1 ? String(payments[0].refundable) : "",
    reason: "",
    reference: "",
    keepsDocumentAccess: null,
  });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const refundable = payments.find(({ payment }) => payment.id === draft.paymentId)?.refundable ?? 0;

  const change = (patch: Partial<RefundDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setError("");
  };

  const handleSubmit = async () => {
    if (pending) return;
    const parsed = parseRefund(draft, refundable);
    if ("problem" in parsed) {
      setError(parsed.problem);
      return;
    }
    setPending(true);
    const recordError = await onRecord(parsed.input);
    setPending(false);
    if (recordError) setError(recordError);
    else onClose();
  };

  return (
    <ModalShell labelledBy="refund-modal-title" pending={pending} onClose={onClose}>
      <p className="modal-eyebrow">{heading}</p>
      <h2 id="refund-modal-title">Record refund</h2>
      <p className="course-help">
        Record a refund you already made outside the app. The original payment stays on record. A refund that returns everything paid cancels a held or confirmed booking.
      </p>

      <div className="field">
        <label htmlFor="refund-payment">Payment refunded</label>
        <select
          id="refund-payment"
          value={draft.paymentId}
          onChange={(e) => {
            const choice = payments.find(({ payment }) => payment.id === e.target.value);
            change({ paymentId: e.target.value, amount: choice ? String(choice.refundable) : "" });
          }}
        >
          <option value="">Choose a payment</option>
          {payments.map(({ payment, refundable: left }) => (
            <option key={payment.id} value={payment.id}>
              {formatRand(payment.amount)} paid{payment.paidAt ? ` ${formatDateTime(payment.paidAt)}` : ""} · {formatRand(left)} refundable
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="refund-amount">Amount refunded (R)</label>
        <input id="refund-amount" inputMode="decimal" value={draft.amount} onChange={(e) => change({ amount: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="refund-reason">Reason</label>
        <textarea id="refund-reason" value={draft.reason} onChange={(e) => change({ reason: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="refund-reference">Refund reference</label>
        <input id="refund-reference" placeholder="Bank or Ozow reference" value={draft.reference} onChange={(e) => change({ reference: e.target.value })} />
      </div>
      <fieldset className="field refund-access">
        <legend>Course documents</legend>
        <label className="course-option">
          <input type="radio" name="refund-access" checked={draft.keepsDocumentAccess === true} onChange={() => change({ keepsDocumentAccess: true })} />
          Student keeps access to course documents
        </label>
        <label className="course-option">
          <input type="radio" name="refund-access" checked={draft.keepsDocumentAccess === false} onChange={() => change({ keepsDocumentAccess: false })} />
          Withdraw access to course documents
        </label>
      </fieldset>

      {error && <span className="field-error" role="alert"><AlertCircle />{error}</span>}
      <button className="btn-submit" onClick={handleSubmit} disabled={pending}>{pending ? "Recording…" : "Record refund"}</button>
    </ModalShell>
  );
}
