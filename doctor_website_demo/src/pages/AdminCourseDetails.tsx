/**
 * AdminCourseDetails.tsx — Production-grade Course Detail Page
 *
 * CHANGES FROM ORIGINAL:
 * 1. Full shell — same sidebar layout as AdminLanding & AdminCourses.
 * 2. Course hero section — title, description, price displayed at the top
 *    (passed via location.state or falls back to dummy data by ID).
 * 3. Class sessions redesigned as a proper table with Location, Instructor,
 *    Spaces Available columns + a status badge (Available / Full).
 * 4. "Add Session" modal — replaces the inline form. Fields: date, location,
 *    instructor (dropdown), capacity.
 * 5. Dummy sessions pre-loaded so page looks alive immediately.
 * 6. Same CSS token system — no new npm packages needed.
 *
 * NPM PACKAGES: lucide-react (already installed)
 */

import React, { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  BookOpen,
  Users,
  LayoutDashboard,
  Settings,
  LogOut,
  Plus,
  X,
  AlertCircle,
  MapPin,
  User,
  CalendarDays,
  ChevronLeft,
} from "lucide-react";

// ─── Styles (same token system) ──────────────────────────────────────────────

const globalStyles = `
  :root {
    --bg:        #F7F6F3;
    --surface:   #FFFFFF;
    --sidebar:   #111110;
    --gold:      #C9A84C;
    --gold-soft: #F5EDD6;
    --text-1:    #111110;
    --text-2:    #6B6A66;
    --text-3:    #A09F9A;
    --border:    #E8E6E1;
    --radius:    14px;
    --font-display: 'Fraunces', Georgia, serif;
    --font-body:    'DM Sans', system-ui, sans-serif;
  }

  .acd-shell * { box-sizing: border-box; margin: 0; padding: 0; }
  .acd-shell { font-family: var(--font-body); background: var(--bg); min-height: 100vh; display: flex; }

  .sidebar { width: 228px; min-height: 100vh; background: var(--sidebar); display: flex; flex-direction: column; padding: 28px 16px; position: fixed; top: 0; left: 0; bottom: 0; z-index: 10; }
  .sidebar-logo { font-family: var(--font-display); font-size: 18px; font-weight: 300; color: #fff; letter-spacing: .02em; padding: 0 8px; margin-bottom: 36px; display: flex; align-items: center; gap: 10px; }
  .sidebar-logo span { color: var(--gold); }
  .sidebar-nav { display: flex; flex-direction: column; gap: 2px; flex: 1; }
  .nav-item { display: flex; align-items: center; gap: 11px; padding: 10px 12px; border-radius: 10px; color: #888887; font-size: 14px; font-weight: 400; text-decoration: none; transition: background .15s, color .15s; cursor: pointer; border: none; background: none; width: 100%; text-align: left; }
  .nav-item:hover { background: rgba(255,255,255,.07); color: #fff; }
  .nav-item.active { background: rgba(201,168,76,.15); color: var(--gold); }
  .nav-item svg { width: 18px; height: 18px; flex-shrink: 0; }
  .nav-section-label { font-size: 10px; font-weight: 500; letter-spacing: .1em; color: #444443; text-transform: uppercase; padding: 0 12px; margin: 20px 0 6px; }
  .sidebar-footer { margin-top: auto; padding-top: 20px; border-top: 1px solid #222221; }

  .acd-main { margin-left: 228px; flex: 1; padding: 40px 44px; max-width: 1000px; }

  /* Back link */
  .back-link { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-3); text-decoration: none; margin-bottom: 24px; transition: color .15s; }
  .back-link:hover { color: var(--text-1); }
  .back-link svg { width: 15px; height: 15px; }

  /* Course hero */
  .course-hero {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    border-left: 3px solid var(--gold); padding: 28px 32px;
    display: flex; align-items: flex-start; justify-content: space-between; gap: 24px;
    margin-bottom: 32px;
    opacity: 0; animation: fadeUp .35s ease .05s forwards;
  }
  .hero-left { flex: 1; }
  .hero-eyebrow { font-size: 11px; font-weight: 500; color: var(--text-3); letter-spacing: .08em; text-transform: uppercase; margin-bottom: 8px; }
  .hero-title { font-family: var(--font-display); font-size: 28px; font-weight: 300; color: var(--text-1); line-height: 1.3; margin-bottom: 10px; }
  .hero-desc { font-size: 14px; color: var(--text-2); line-height: 1.7; max-width: 520px; }
  .hero-right { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; flex-shrink: 0; }
  .hero-price { font-family: var(--font-display); font-size: 30px; font-weight: 300; color: var(--text-1); }
  .hero-price-label { font-size: 11px; color: var(--text-3); text-align: right; }
  .hero-cat { font-size: 12px; font-weight: 500; color: var(--text-3); background: var(--bg); border: 1px solid var(--border); padding: 4px 12px; border-radius: 20px; }

  /* Section header */
  .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  .section-title { font-size: 13px; font-weight: 500; color: var(--text-2); letter-spacing: .06em; text-transform: uppercase; }
  .btn-primary { display: flex; align-items: center; gap: 7px; background: var(--text-1); color: #fff; border: none; padding: 10px 18px; border-radius: 10px; font-family: var(--font-body); font-size: 13px; font-weight: 500; cursor: pointer; transition: background .15s, transform .1s; }
  .btn-primary:hover { background: #2a2a28; transform: translateY(-1px); }
  .btn-primary svg { width: 15px; height: 15px; }

  /* Sessions table */
  .sessions-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    overflow: hidden;
    opacity: 0; animation: fadeUp .35s ease .15s forwards;
  }
  .sessions-table { width: 100%; border-collapse: collapse; }
  .sessions-table thead th { padding: 13px 20px; font-size: 11px; font-weight: 500; letter-spacing: .08em; text-transform: uppercase; color: var(--text-3); border-bottom: 1px solid var(--border); text-align: left; background: #FAFAF8; }
  .sessions-table tbody tr { border-bottom: 1px solid var(--border); transition: background .12s; }
  .sessions-table tbody tr:last-child { border-bottom: none; }
  .sessions-table tbody tr:hover { background: #FAFAF8; }
  .sessions-table tbody td { padding: 15px 20px; font-size: 14px; color: var(--text-1); }
  .sessions-table tbody td.muted { color: var(--text-2); }

  /* Cell meta rows */
  .cell-with-icon { display: flex; align-items: center; gap: 8px; }
  .cell-with-icon svg { width: 14px; height: 14px; color: var(--text-3); flex-shrink: 0; }

  /* Spaces badge */
  .spaces-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
  .spaces-ok   { background: #EAF5EE; color: #2E7D52; }
  .spaces-low  { background: #FEF4E4; color: #9A6500; }
  .spaces-full { background: #FEE9E9; color: #A12D2D; }
  .spaces-dot  { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

  /* Empty state */
  .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; text-align: center; }
  .empty-icon { width: 52px; height: 52px; background: var(--gold-soft); border-radius: 14px; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }
  .empty-icon svg { width: 24px; height: 24px; color: var(--gold); }
  .empty-title { font-family: var(--font-display); font-size: 18px; font-weight: 300; color: var(--text-1); margin-bottom: 6px; }
  .empty-sub { font-size: 13px; color: var(--text-3); max-width: 240px; line-height: 1.6; }

  /* Modal */
  .modal-overlay { position: fixed; inset: 0; background: rgba(17,17,16,.45); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; animation: fadeIn .15s ease; }
  .modal { background: var(--surface); border-radius: 18px; width: 100%; max-width: 460px; padding: 32px; position: relative; animation: slideUp .2s ease; }
  .modal-close { position: absolute; top: 20px; right: 20px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-2); transition: background .12s; }
  .modal-close:hover { background: var(--border); }
  .modal-close svg { width: 16px; height: 16px; }
  .modal-eyebrow { font-size: 11px; font-weight: 500; color: var(--text-3); letter-spacing: .08em; text-transform: uppercase; margin-bottom: 6px; }
  .modal h2 { font-family: var(--font-display); font-size: 24px; font-weight: 300; color: var(--text-1); margin-bottom: 26px; }

  .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
  .field label { font-size: 12px; font-weight: 500; color: var(--text-2); letter-spacing: .04em; text-transform: uppercase; }
  .field input, .field textarea, .field select { width: 100%; border: 1px solid var(--border); border-radius: 10px; padding: 11px 14px; font-family: var(--font-body); font-size: 14px; color: var(--text-1); background: #FAFAF8; outline: none; transition: border-color .15s; appearance: none; }
  .field input:focus, .field select:focus { border-color: var(--gold); background: #fff; }
  .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .field-error { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #C0392B; }
  .field-error svg { width: 13px; height: 13px; }
  .btn-submit { width: 100%; background: var(--text-1); color: #fff; border: none; padding: 13px; border-radius: 10px; font-family: var(--font-body); font-size: 14px; font-weight: 500; cursor: pointer; transition: background .15s; margin-top: 6px; }
  .btn-submit:hover { background: #2a2a28; }

  @keyframes fadeUp  { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
`;

// ─── Data ─────────────────────────────────────────────────────────────────────

const INSTRUCTORS = ["Dr Pietie van Wyk", "Dr Sielie Botha", "Dr Mielie Joubert"];

interface ClassSession {
  id: number;
  date: string;
  location: string;
  instructor: string;
  capacity: number;
  enrolled: number;
}

// Dummy course details keyed by ID (in a real app this comes from an API)
const DUMMY_COURSES: Record<string, { title: string; description: string; price: number; category: string }> = {
  "1": { title: "Advanced Human Anatomy", description: "A deep dive into musculoskeletal systems, organ placement, and clinical correlations used in daily practice.", price: 1499, category: "Anatomy" },
  "2": { title: "Clinical Pharmacology Essentials", description: "Drug classes, mechanisms of action, and prescribing principles for general practitioners and specialists.", price: 1299, category: "Pharmacology" },
  "3": { title: "Diagnostic Imaging Fundamentals", description: "Reading X-rays, CT scans, and MRIs with confidence. Covers the most common presentations seen in practice.", price: 1799, category: "Diagnostics" },
};

const DUMMY_SESSIONS: ClassSession[] = [
  { id: 1, date: "2026-07-14", location: "Cape Town Medical Centre, Room 4A", instructor: "Dr Pietie van Wyk", capacity: 20, enrolled: 14 },
  { id: 2, date: "2026-07-21", location: "Johannesburg Health Campus, Lab 2", instructor: "Dr Sielie Botha",   capacity: 15, enrolled: 15 },
  { id: 3, date: "2026-08-04", location: "Pretoria University Hospital, Seminar B", instructor: "Dr Mielie Joubert", capacity: 18, enrolled: 5 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
}

function SpacesBadge({ capacity, enrolled }: { capacity: number; enrolled: number }) {
  const available = capacity - enrolled;
  const pct = enrolled / capacity;
  const cls = available === 0 ? "spaces-full" : pct >= 0.8 ? "spaces-low" : "spaces-ok";
  const label = available === 0 ? "Full" : `${available} / ${capacity} open`;
  return <span className={`spaces-badge ${cls}`}><span className="spaces-dot" />{label}</span>;
}

// ─── Sidebar nav item ─────────────────────────────────────────────────────────

function NavItem({ to, icon: Icon, label, active }: { to: string; icon: React.ElementType; label: string; active: boolean }) {
  return (
    <Link to={to} className={`nav-item${active ? " active" : ""}`}>
      <Icon />{label}
    </Link>
  );
}

// ─── Add Session Modal ────────────────────────────────────────────────────────

function AddSessionModal({ onClose, onAdd }: { onClose: () => void; onAdd: (s: Omit<ClassSession, "id" | "enrolled">) => void }) {
  const [date, setDate]           = useState("");
  const [location, setLocation]   = useState("");
  const [instructor, setInstructor] = useState(INSTRUCTORS[0]);
  const [capacity, setCapacity]   = useState("");
  const [errors, setErrors]       = useState<{ date?: string; location?: string; capacity?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!date)                                       e.date     = "Please select a date";
    if (!location.trim())                            e.location = "Location is required";
    if (!capacity || isNaN(+capacity) || +capacity < 1) e.capacity = "Enter a valid capacity";
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onAdd({ date, location: location.trim(), instructor, capacity: Number(capacity) });
    onClose();
  };

  const stopProp = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={stopProp} role="dialog" aria-modal="true" aria-labelledby="session-modal-title">
        <button className="modal-close" onClick={onClose} aria-label="Close"><X /></button>

        <p className="modal-eyebrow">Schedule</p>
        <h2 id="session-modal-title">Add a class session</h2>

        <div className="field-row">
          <div className="field">
            <label htmlFor="s-date">Date</label>
            <input id="s-date" type="date" value={date} onChange={e => { setDate(e.target.value); setErrors(p => ({ ...p, date: undefined })); }} />
            {errors.date && <span className="field-error"><AlertCircle />{errors.date}</span>}
          </div>
          <div className="field">
            <label htmlFor="s-cap">Capacity</label>
            <input id="s-cap" type="number" min="1" placeholder="e.g. 20" value={capacity} onChange={e => { setCapacity(e.target.value); setErrors(p => ({ ...p, capacity: undefined })); }} />
            {errors.capacity && <span className="field-error"><AlertCircle />{errors.capacity}</span>}
          </div>
        </div>

        <div className="field">
          <label htmlFor="s-loc">Location</label>
          <input id="s-loc" type="text" placeholder="e.g. Cape Town Medical Centre, Room 4A" value={location} onChange={e => { setLocation(e.target.value); setErrors(p => ({ ...p, location: undefined })); }} />
          {errors.location && <span className="field-error"><AlertCircle />{errors.location}</span>}
        </div>

        <div className="field">
          <label htmlFor="s-inst">Instructor</label>
          <select id="s-inst" value={instructor} onChange={e => setInstructor(e.target.value)}>
            {INSTRUCTORS.map(i => <option key={i}>{i}</option>)}
          </select>
        </div>

        <button className="btn-submit" onClick={handleSubmit}>Schedule session</button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminCourseDetails() {
  const { id } = useParams<{ id: string }>();
  const routerLocation = useLocation();
  const { pathname } = routerLocation;

  // Course data — prefer state passed from the list, fall back to dummy lookup
  const passedCourse = (routerLocation.state as any)?.course;
  const course = passedCourse ?? DUMMY_COURSES[id ?? "1"] ?? DUMMY_COURSES["1"];

  const [sessions, setSessions] = useState<ClassSession[]>(DUMMY_SESSIONS);
  const [showModal, setShowModal] = useState(false);

  const handleAdd = (data: Omit<ClassSession, "id" | "enrolled">) => {
    setSessions(prev => [{ id: Date.now(), enrolled: 0, ...data }, ...prev]);
  };

  return (
    <>
      <style>{globalStyles}</style>

      <div className="acd-shell">
        {/* ── Sidebar ── */}
        <aside className="sidebar">
          <div className="sidebar-logo"><BookOpen size={20} color="var(--gold)" />Dr <span>Admin</span></div>
          <nav className="sidebar-nav">
            <p className="nav-section-label">Main</p>
            <NavItem to="/"             icon={LayoutDashboard} label="Dashboard" active={pathname === "/"} />
            <NavItem to="/admincourses" icon={BookOpen}        label="Courses"   active={pathname.startsWith("/admincourses")} />
            <NavItem to="/patients"     icon={Users}           label="Students"  active={pathname.startsWith("/patients")} />
            <p className="nav-section-label">Account</p>
            <NavItem to="/settings"     icon={Settings}        label="Settings"  active={pathname.startsWith("/settings")} />
          </nav>
          <div className="sidebar-footer">
            <button className="nav-item" style={{ color: "#665F5C" }}><LogOut />Sign out</button>
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="acd-main">
          <Link to="/admincourses" className="back-link"><ChevronLeft />Back to courses</Link>

          {/* Course hero */}
          <div className="course-hero">
            <div className="hero-left">
              <p className="hero-eyebrow">{course.category}</p>
              <h1 className="hero-title">{course.title}</h1>
              <p className="hero-desc">{course.description}</p>
            </div>
            <div className="hero-right">
              <p className="hero-price-label">Course price</p>
              <p className="hero-price">R {course.price.toLocaleString()}</p>
              <span className="hero-cat">{course.category}</span>
            </div>
          </div>

          {/* Sessions */}
          <div className="section-header">
            <p className="section-title">Class sessions</p>
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              <Plus />Add session
            </button>
          </div>

          <div className="sessions-card">
            {sessions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><CalendarDays /></div>
                <p className="empty-title">No sessions scheduled</p>
                <p className="empty-sub">Add the first session and students will be able to book their spot.</p>
              </div>
            ) : (
              <table className="sessions-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Location</th>
                    <th>Instructor</th>
                    <th>Spaces</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(s => (
                    <tr key={s.id}>
                      <td>
                        <div className="cell-with-icon">
                          <CalendarDays />
                          {formatDate(s.date)}
                        </div>
                      </td>
                      <td className="muted">
                        <div className="cell-with-icon">
                          <MapPin />
                          {s.location}
                        </div>
                      </td>
                      <td className="muted">
                        <div className="cell-with-icon">
                          <User />
                          {s.instructor}
                        </div>
                      </td>
                      <td><SpacesBadge capacity={s.capacity} enrolled={s.enrolled} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>

      {showModal && <AddSessionModal onClose={() => setShowModal(false)} onAdd={handleAdd} />}
    </>
  );
}
