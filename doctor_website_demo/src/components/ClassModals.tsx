import React, { useEffect, useState } from "react";
import { AlertCircle, X } from "lucide-react";
import { instructorName, type Instructor } from "../lib/instructors";
import { scheduleProblem, type ClassSchedule } from "../lib/classes";
import { createLocation, locationLabel, type LocationRow } from "../lib/locations";

const NEW_LOCATION = "__new__";

function ModalShell({
  labelledBy,
  pending,
  onClose,
  children,
}: {
  labelledBy: string;
  pending: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, pending]);

  return (
    <div className="modal-overlay" onClick={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        <button className="modal-close" onClick={onClose} disabled={pending} aria-label="Close"><X /></button>
        {children}
      </div>
    </div>
  );
}

export function InstructorChecklist({
  instructors,
  selected,
  onChange,
}: {
  instructors: Instructor[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  if (instructors.length === 0) {
    return <p className="readonly-sub">No active teachers are authorized for this course. Authorize one under Users first.</p>;
  }
  return (
    <div className="course-list">
      {instructors.map((instructor) => {
        const inputId = `teacher-${instructor.id}`;
        return (
          <label key={instructor.id} htmlFor={inputId} className="course-option">
            <input
              id={inputId}
              type="checkbox"
              checked={selected.includes(instructor.id)}
              onChange={() => onChange(
                selected.includes(instructor.id)
                  ? selected.filter((id) => id !== instructor.id)
                  : [...selected, instructor.id],
              )}
            />
            {instructorName(instructor)}
          </label>
        );
      })}
    </div>
  );
}

export function EditTeachersModal({
  heading,
  currentIds,
  instructors,
  onClose,
  onSave,
}: {
  heading: string;
  currentIds: string[];
  instructors: Instructor[];
  onClose: () => void;
  onSave: (instructorIds: string[]) => Promise<string | null>;
}) {
  const offered = new Set(instructors.map((instructor) => instructor.id));
  const stillAuthorized = currentIds.filter((id) => offered.has(id));
  const unauthorizedCount = currentIds.length - stillAuthorized.length;
  const [instructorIds, setInstructorIds] = useState(stillAuthorized);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const handleSubmit = async () => {
    if (pending) return;
    if (instructorIds.length === 0) {
      setError("Select at least one teacher");
      return;
    }
    setPending(true);
    setError("");
    const saveError = await onSave(instructorIds);
    setPending(false);
    if (saveError) setError(saveError);
    else onClose();
  };

  return (
    <ModalShell labelledBy="teachers-modal-title" pending={pending} onClose={onClose}>
      <p className="modal-eyebrow">{heading}</p>
      <h2 id="teachers-modal-title">Class teachers</h2>
      {unauthorizedCount > 0 && (
        <p className="course-help">
          {unauthorizedCount === 1 ? "One current teacher is" : `${unauthorizedCount} current teachers are`} no longer active or authorized for this course and will be removed when you save.
        </p>
      )}
      <fieldset style={{ border: "none", padding: 0, margin: "0 0 18px" }}>
        <legend className="readonly-label" style={{ marginBottom: 6 }}>Teachers</legend>
        <InstructorChecklist instructors={instructors} selected={instructorIds} onChange={(ids) => { setInstructorIds(ids); setError(""); }} />
      </fieldset>
      {error && <span className="field-error" role="alert"><AlertCircle />{error}</span>}
      <button className="btn-submit" onClick={handleSubmit} disabled={pending}>{pending ? "Saving…" : "Save teachers"}</button>
    </ModalShell>
  );
}

function LocationPicker({
  locations,
  value,
  onChange,
  onCreated,
}: {
  locations: LocationRow[];
  value: string;
  onChange: (id: string) => void;
  onCreated: (location: LocationRow) => void;
}) {
  const [adding, setAdding] = useState(locations.length === 0);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Give the location a name.");
      return;
    }
    setSaving(true);
    const { location, error: saveError } = await createLocation(name, address);
    setSaving(false);
    if (!location) {
      setError(saveError ?? "The location was not saved.");
      return;
    }
    onCreated(location);
    onChange(location.id);
    setAdding(false);
    setName("");
    setAddress("");
    setError("");
  };

  return (
    <>
      <div className="field">
        <label htmlFor="class-location">Location</label>
        <select
          id="class-location"
          value={adding ? NEW_LOCATION : value}
          onChange={(e) => {
            if (e.target.value === NEW_LOCATION) setAdding(true);
            else {
              setAdding(false);
              onChange(e.target.value);
            }
          }}
        >
          {locations.map((location) => <option key={location.id} value={location.id}>{locationLabel(location)}</option>)}
          <option value={NEW_LOCATION}>Add a new location…</option>
        </select>
      </div>
      {adding && (
        <div className="field-row">
          <div className="field">
            <label htmlFor="new-location-name">New location name</label>
            <input id="new-location-name" type="text" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} />
          </div>
          <div className="field">
            <label htmlFor="new-location-address">Address</label>
            <input id="new-location-address" type="text" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <button type="button" className="btn-link" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save location"}</button>
        </div>
      )}
      {error && <span className="field-error" role="alert"><AlertCircle />{error}</span>}
    </>
  );
}

type ClassFormMode =
  | { kind: "schedule" }
  | { kind: "reschedule"; heading: string; initial: ClassSchedule; booked: number };

export function ClassFormModal({
  mode,
  instructors,
  locations,
  onLocationCreated,
  onClose,
  onSubmit,
}: {
  mode: ClassFormMode;
  instructors: Instructor[];
  locations: LocationRow[];
  onLocationCreated: (location: LocationRow) => void;
  onClose: () => void;
  onSubmit: (schedule: ClassSchedule, instructorIds: string[]) => Promise<string | null>;
}) {
  const initial = mode.kind === "reschedule" ? mode.initial : null;
  const [locationId, setLocationId] = useState(initial?.locationId ?? locations[0]?.id ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [startTime, setStartTime] = useState(initial?.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(initial?.endTime ?? "12:00");
  const [maxStudents, setMaxStudents] = useState(String(initial?.maxStudents ?? 20));
  const [instructorIds, setInstructorIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const handleSubmit = async () => {
    if (pending) return;
    const schedule: ClassSchedule = { locationId, startDate, endDate, startTime, endTime, maxStudents: Number(maxStudents) };
    const problem = scheduleProblem(schedule)
      ?? (mode.kind === "schedule" && instructorIds.length === 0 ? "Select at least one teacher." : null)
      ?? (mode.kind === "reschedule" && schedule.maxStudents < mode.booked ? `Capacity cannot be below the ${mode.booked} students already booked.` : null);
    if (problem) {
      setError(problem);
      return;
    }
    setPending(true);
    setError("");
    const submitError = await onSubmit(schedule, instructorIds);
    setPending(false);
    if (submitError) setError(submitError);
    else onClose();
  };

  return (
    <ModalShell labelledBy="class-modal-title" pending={pending} onClose={onClose}>
      <p className="modal-eyebrow">{mode.kind === "schedule" ? "Schedule" : mode.heading}</p>
      <h2 id="class-modal-title">{mode.kind === "schedule" ? "Schedule a class" : "Reschedule class"}</h2>
      {mode.kind === "reschedule" && (
        <p className="course-help">
          {mode.booked === 1 ? "1 student is" : `${mode.booked} students are`} booked. They will see the new date, time and location on their courses page.
        </p>
      )}

      {mode.kind === "schedule" && (
        <fieldset style={{ border: "none", padding: 0, margin: "0 0 18px" }}>
          <legend className="readonly-label" style={{ marginBottom: 6 }}>Teachers</legend>
          <InstructorChecklist instructors={instructors} selected={instructorIds} onChange={(ids) => { setInstructorIds(ids); setError(""); }} />
        </fieldset>
      )}

      <LocationPicker locations={locations} value={locationId} onChange={setLocationId} onCreated={onLocationCreated} />
      <div className="field-row">
        <div className="field"><label htmlFor="class-start-date">Start date</label><input id="class-start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
        <div className="field"><label htmlFor="class-end-date">End date</label><input id="class-end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
      </div>
      <div className="field-row">
        <div className="field"><label htmlFor="class-start-time">Start time</label><input id="class-start-time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
        <div className="field"><label htmlFor="class-end-time">End time</label><input id="class-end-time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
      </div>
      <div className="field">
        <label htmlFor="class-capacity">Capacity</label>
        <input id="class-capacity" type="number" min={mode.kind === "reschedule" ? Math.max(1, mode.booked) : 1} value={maxStudents} onChange={(e) => setMaxStudents(e.target.value)} />
      </div>

      {error && <span className="field-error" role="alert"><AlertCircle />{error}</span>}
      <button className="btn-submit" onClick={handleSubmit} disabled={pending}>
        {pending ? "Saving…" : mode.kind === "schedule" ? "Schedule class" : "Save new schedule"}
      </button>
    </ModalShell>
  );
}

export function CancelClassModal({
  heading,
  booked,
  onClose,
  onCancel,
}: {
  heading: string;
  booked: number;
  onClose: () => void;
  onCancel: (reason: string) => Promise<string | null>;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const handleSubmit = async () => {
    if (pending) return;
    if (!reason.trim()) {
      setError("Give a reason. Booked students will see it.");
      return;
    }
    setPending(true);
    setError("");
    const cancelError = await onCancel(reason);
    setPending(false);
    if (cancelError) setError(cancelError);
    else onClose();
  };

  return (
    <ModalShell labelledBy="cancel-modal-title" pending={pending} onClose={onClose}>
      <p className="modal-eyebrow">{heading}</p>
      <h2 id="cancel-modal-title">Cancel class</h2>
      <p className="course-help">
        {booked === 0
          ? "No students are booked on this class."
          : `${booked === 1 ? "1 booking" : `${booked} bookings`} will be marked Class Cancelled. Bookings and payments are kept so refunds can be handled.`}
        {" "}A cancelled class cannot be rescheduled.
      </p>
      <div className="field">
        <label htmlFor="cancel-reason">Reason</label>
        <textarea id="cancel-reason" value={reason} onChange={(e) => { setReason(e.target.value); setError(""); }} />
      </div>
      {error && <span className="field-error" role="alert"><AlertCircle />{error}</span>}
      <button className="btn-submit" onClick={handleSubmit} disabled={pending}>{pending ? "Cancelling…" : "Cancel class"}</button>
    </ModalShell>
  );
}
