import { useState } from "react";
import { AlertCircle, X } from "lucide-react";
import { courseProblem, type CourseDraft } from "../lib/courses";

export default function CourseFormModal({
  initial,
  onClose,
  onSave,
}: {
  initial: CourseDraft | null;
  onClose: () => void;
  onSave: (draft: CourseDraft) => Promise<string | null>;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const handleSubmit = async () => {
    if (pending) return;
    const draft: CourseDraft = { title, description, price: Number(price), active };
    const problem = courseProblem(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setPending(true);
    setError("");
    const saveError = await onSave(draft);
    setPending(false);
    if (saveError) setError(saveError);
    else onClose();
  };

  return (
    <div className="modal-overlay" onClick={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="course-modal-title">
        <button className="modal-close" onClick={onClose} disabled={pending} aria-label="Close"><X /></button>
        <p className="modal-eyebrow">{initial ? "Edit course" : "New course"}</p>
        <h2 id="course-modal-title">{initial ? initial.title : "Add a course"}</h2>

        <div className="field">
          <label htmlFor="course-title">Course title</label>
          <input id="course-title" type="text" placeholder="e.g. Advanced Human Anatomy" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="course-desc">Description</label>
          <textarea id="course-desc" placeholder="What will students learn in this course?" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="course-price">Price (R)</label>
          <input id="course-price" type="number" min="0" placeholder="e.g. 1499" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <label htmlFor="course-active" className="course-option" style={{ marginBottom: 18 }}>
          <input id="course-active" type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active: show this course in the student catalog
        </label>

        {error && <span className="field-error" role="alert"><AlertCircle />{error}</span>}
        <button className="btn-submit" onClick={handleSubmit} disabled={pending}>
          {pending ? "Saving…" : initial ? "Save course" : "Create course"}
        </button>
      </div>
    </div>
  );
}
