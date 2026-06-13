/**
 * StudentCourseDetails.tsx — Production-grade Student Course Detail Page
 *
 * CHANGES FROM ORIGINAL:
 * 1. Full shell — same navy/teal sidebar as StudentLanding & StudentCourses.
 * 2. Course hero — title, description, category, duration pulled from
 *    location.state (passed from StudentCourses) with a fallback.
 * 3. Sessions table — date, location, instructor, seats with colour-coded badge.
 *    Each row has a "Book now" button that disables after booking.
 * 4. Booking confirmation modal — redesigned with a teal success icon,
 *    summary of what was booked, and a clean close button.
 * 5. Back link → /courses
 * 6. Same CSS token system — no new packages.
 *
 * NPM: lucide-react (already installed)
 */

import React, { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  BookOpen, LayoutDashboard, Settings, LogOut,
  Bell, GraduationCap, CalendarDays, Clock,
  MapPin, User, ChevronLeft, CheckCircle, X, Users,
} from "lucide-react";

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = `
  :root {
    --s-bg:       #F4F7FB;
    --s-surface:  #FFFFFF;
    --s-navy:     #0F1E35;
    --s-teal:     #2BBFAA;
    --s-teal-soft:#E6F7F5;
    --s-teal-mid: #1A9E8C;
    --s-text-1:   #0F1E35;
    --s-text-2:   #4A5568;
    --s-text-3:   #94A3B8;
    --s-border:   #E2E8F0;
    --s-radius:   12px;
    --s-font:     'Plus Jakarta Sans', system-ui, sans-serif;
  }

  .scd-shell * { box-sizing: border-box; margin: 0; padding: 0; }
  .scd-shell { font-family: var(--s-font); background: var(--s-bg); min-height: 100vh; display: flex; }

  /* ── Sidebar ── */
  .sl-sidebar { width: 224px; min-height: 100vh; background: var(--s-navy); display: flex; flex-direction: column; padding: 26px 14px; position: fixed; top: 0; left: 0; bottom: 0; z-index: 10; }
  .sl-logo { display: flex; align-items: center; gap: 10px; padding: 0 8px; margin-bottom: 32px; }
  .sl-logo-mark { width: 30px; height: 30px; border-radius: 8px; background: var(--s-teal); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .sl-logo-mark svg { width: 16px; height: 16px; color: #fff; }
  .sl-logo-text { font-size: 14px; font-weight: 600; color: #fff; line-height: 1.2; }
  .sl-logo-text span { display: block; font-size: 11px; font-weight: 400; color: #4A6080; }
  .sl-nav { display: flex; flex-direction: column; gap: 2px; flex: 1; }
  .sl-nav-label { font-size: 10px; font-weight: 600; letter-spacing: .08em; color: #2D3F58; text-transform: uppercase; padding: 0 10px; margin: 18px 0 5px; }
  .sl-nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 9px; color: #64748B; font-size: 13px; font-weight: 400; text-decoration: none; transition: background .15s, color .15s; cursor: pointer; border: none; background: none; width: 100%; text-align: left; }
  .sl-nav-item:hover { background: rgba(255,255,255,.06); color: #CBD5E1; }
  .sl-nav-item.active { background: rgba(43,191,170,.15); color: var(--s-teal); font-weight: 500; }
  .sl-nav-item svg { width: 17px; height: 17px; flex-shrink: 0; }
  .sl-footer { margin-top: auto; padding-top: 18px; border-top: 1px solid #1E3050; }
  .sl-avatar-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; margin-bottom: 10px; }
  .sl-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--s-teal); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; color: #fff; flex-shrink: 0; }
  .sl-avatar-name { font-size: 13px; font-weight: 500; color: #CBD5E1; }
  .sl-avatar-role { font-size: 11px; color: #4A6080; }

  /* ── Main ── */
  .scd-main { margin-left: 224px; flex: 1; padding: 32px 40px; max-width: 960px; }

  /* Back link */
  .back-link { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; color: var(--s-text-3); text-decoration: none; margin-bottom: 22px; transition: color .15s; font-weight: 500; }
  .back-link:hover { color: var(--s-text-1); }
  .back-link svg { width: 15px; height: 15px; }

  /* ── Course hero ── */
  .hero {
    background: var(--s-navy); border-radius: var(--s-radius);
    padding: 28px 32px; display: flex; align-items: flex-start; justify-content: space-between; gap: 24px;
    margin-bottom: 28px;
    opacity: 0; animation: fadeUp .35s ease .05s forwards;
  }
  .hero-left .eyebrow { font-size: 11px; font-weight: 600; color: #4A6080; letter-spacing: .07em; text-transform: uppercase; margin-bottom: 7px; }
  .hero-left h1 { font-size: 26px; font-weight: 700; color: #fff; letter-spacing: -.02em; margin-bottom: 10px; line-height: 1.25; }
  .hero-left p { font-size: 14px; color: #64748B; line-height: 1.7; max-width: 480px; }
  .hero-right { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; flex-shrink: 0; }
  .hero-meta { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #4A6080; }
  .hero-meta svg { width: 14px; height: 14px; }
  .hero-cat { font-size: 12px; font-weight: 600; background: rgba(43,191,170,.15); color: var(--s-teal); padding: 4px 12px; border-radius: 20px; }

  /* ── Section header ── */
  .s-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  .s-title { font-size: 12px; font-weight: 700; color: var(--s-text-2); letter-spacing: .07em; text-transform: uppercase; }

  /* ── Sessions table ── */
  .sessions-card {
    background: var(--s-surface); border: 1px solid var(--s-border); border-radius: var(--s-radius);
    overflow: hidden;
    opacity: 0; animation: fadeUp .35s ease .15s forwards;
  }
  .sessions-table { width: 100%; border-collapse: collapse; }
  .sessions-table thead th { padding: 12px 18px; font-size: 11px; font-weight: 600; letter-spacing: .07em; text-transform: uppercase; color: var(--s-text-3); border-bottom: 1px solid var(--s-border); text-align: left; background: #F8FAFC; }
  .sessions-table tbody tr { border-bottom: 1px solid var(--s-border); transition: background .12s; }
  .sessions-table tbody tr:last-child { border-bottom: none; }
  .sessions-table tbody tr:hover { background: #F8FAFC; }
  .sessions-table tbody td { padding: 15px 18px; font-size: 13px; color: var(--s-text-1); vertical-align: middle; }
  .sessions-table tbody td.muted { color: var(--s-text-2); }

  .cell-icon { display: flex; align-items: center; gap: 7px; }
  .cell-icon svg { width: 14px; height: 14px; color: var(--s-text-3); flex-shrink: 0; }

  /* Seats badge */
  .seats-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
  .seats-ok   { background: var(--s-teal-soft); color: var(--s-teal-mid); }
  .seats-low  { background: #FFFBEB; color: #D97706; }
  .seats-full { background: #FEE9E9; color: #DC2626; }
  .seats-dot  { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }

  /* Book button */
  .book-btn { background: var(--s-teal); color: #fff; border: none; padding: 8px 18px; border-radius: 8px; font-family: var(--s-font); font-size: 13px; font-weight: 500; cursor: pointer; transition: background .15s; white-space: nowrap; }
  .book-btn:hover { background: var(--s-teal-mid); }
  .book-btn:disabled { background: var(--s-border); color: var(--s-text-3); cursor: not-allowed; }
  .booked-label { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 500; color: var(--s-teal-mid); }
  .booked-label svg { width: 14px; height: 14px; }

  /* ── Booking modal ── */
  .modal-overlay { position: fixed; inset: 0; background: rgba(15,30,53,.5); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; animation: fadeIn .15s ease; }
  .modal { background: var(--s-surface); border-radius: 18px; width: 100%; max-width: 420px; padding: 36px 32px; position: relative; text-align: center; animation: slideUp .2s ease; }
  .modal-close { position: absolute; top: 18px; right: 18px; background: var(--s-bg); border: 1px solid var(--s-border); border-radius: 8px; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--s-text-2); }
  .modal-close svg { width: 15px; height: 15px; }
  .modal-icon { width: 56px; height: 56px; border-radius: 50%; background: var(--s-teal-soft); display: flex; align-items: center; justify-content: center; margin: 0 auto 18px; }
  .modal-icon svg { width: 28px; height: 28px; color: var(--s-teal); }
  .modal h2 { font-size: 20px; font-weight: 700; color: var(--s-text-1); margin-bottom: 10px; }
  .modal p { font-size: 14px; color: var(--s-text-2); line-height: 1.7; margin-bottom: 24px; }
  .modal p strong { color: var(--s-text-1); font-weight: 600; }
  .modal-summary { background: var(--s-bg); border: 1px solid var(--s-border); border-radius: 10px; padding: 14px 18px; text-align: left; margin-bottom: 22px; display: flex; flex-direction: column; gap: 8px; }
  .ms-row { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--s-text-2); }
  .ms-row svg { width: 14px; height: 14px; color: var(--s-teal); flex-shrink: 0; }
  .ms-row strong { color: var(--s-text-1); font-weight: 500; }
  .modal-btn { width: 100%; background: var(--s-teal); color: #fff; border: none; padding: 12px; border-radius: 10px; font-family: var(--s-font); font-size: 14px; font-weight: 500; cursor: pointer; }
  .modal-btn:hover { background: var(--s-teal-mid); }

  @keyframes fadeUp  { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
`;

// ─── Data ─────────────────────────────────────────────────────────────────────

interface Session {
  id: number;
  date: string;
  location: string;
  instructor: string;
  duration: string;
  seatsLeft: number;
  totalSeats: number;
}

const DUMMY_SESSIONS: Session[] = [
  { id: 1, date: "10 Apr 2026", location: "Cape Town Medical Centre, Room 4A",      instructor: "Dr Pietie van Wyk",  duration: "3 hrs", seatsLeft: 6, totalSeats: 20 },
  { id: 2, date: "17 Apr 2026", location: "JHB Health Campus, Lab 2",               instructor: "Dr Sielie Botha",    duration: "3 hrs", seatsLeft: 4, totalSeats: 18 },
  { id: 3, date: "24 Apr 2026", location: "Pretoria University Hospital, Seminar B", instructor: "Dr Mielie Joubert", duration: "3 hrs", seatsLeft: 2, totalSeats: 15 },
];

const FALLBACK_COURSE = {
  title: "CPR Training",
  description: "Learn life-saving CPR techniques used in cardiac emergencies, including chest compressions and AED operation.",
  category: "Emergency",
  duration: "3 hrs",
  seatsLeft: 6,
  totalSeats: 20,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SeatsBadge({ seats }: { seats: number }) {
  const cls   = seats <= 1 ? "seats-full" : seats <= 3 ? "seats-low" : "seats-ok";
  const label = seats === 0 ? "Full" : seats === 1 ? "1 seat left" : `${seats} seats left`;
  return <span className={`seats-badge ${cls}`}><span className="seats-dot" />{label}</span>;
}

function NavItem({ to, icon: Icon, label, active }: { to: string; icon: React.ElementType; label: string; active: boolean }) {
  return (
    <Link to={to} className={`sl-nav-item${active ? " active" : ""}`}>
      <Icon />{label}
    </Link>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StudentCourseDetails() {
  const { pathname } = useLocation();
  const routerLocation = useLocation();
  const passedCourse = (routerLocation.state as any)?.course;
  const course = passedCourse ?? FALLBACK_COURSE;

  const [bookedIds, setBookedIds]         = useState<number[]>([]);
  const [showModal, setShowModal]         = useState(false);
  const [bookedSession, setBookedSession] = useState<Session | null>(null);

  const handleBook = (session: Session) => {
    setBookedIds((prev) => [...prev, session.id]);
    setBookedSession(session);
    setShowModal(true);
  };

  return (
    <>
      <style>{styles}</style>
      <div className="scd-shell">

        {/* ── Sidebar ── */}
        <aside className="sl-sidebar">
          <div className="sl-logo">
            <div className="sl-logo-mark"><BookOpen /></div>
            <div className="sl-logo-text">MedLearn<span>Student Portal</span></div>
          </div>
          <nav className="sl-nav">
            <p className="sl-nav-label">Menu</p>
            <NavItem to="/studentlanding" icon={LayoutDashboard} label="Dashboard"     active={pathname === "/studentlanding"} />
            <NavItem to="/courses"        icon={BookOpen}        label="My Courses"    active={pathname.startsWith("/courses")} />
            <NavItem to="/grades"         icon={GraduationCap}   label="Grades"        active={pathname.startsWith("/grades")} />
            <NavItem to="/notifications"  icon={Bell}            label="Notifications" active={pathname.startsWith("/notifications")} />
            <p className="sl-nav-label">Account</p>
            <NavItem to="/settings"       icon={Settings}        label="Settings"      active={pathname.startsWith("/settings")} />
          </nav>
          <div className="sl-footer">
            <div className="sl-avatar-row">
              <div className="sl-avatar">JS</div>
              <div>
                <p className="sl-avatar-name">John Student</p>
                <p className="sl-avatar-role">student123@gmail.com</p>
              </div>
            </div>
            <button className="sl-nav-item" style={{ color: "#4A6080" }}><LogOut />Sign out</button>
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="scd-main">
          <Link to="/courses" className="back-link"><ChevronLeft />Back to courses</Link>

          {/* Course hero */}
          <div className="hero">
            <div className="hero-left">
              <p className="eyebrow">{course.category}</p>
              <h1>{course.title}</h1>
              <p>{course.description}</p>
            </div>
            <div className="hero-right">
              <span className="hero-cat">{course.category}</span>
              <span className="hero-meta"><Clock />Duration: {course.duration ?? "3 hrs"}</span>
              <span className="hero-meta"><Users />{course.totalSeats ?? 20} seats per session</span>
            </div>
          </div>

          {/* Sessions */}
          <div className="s-header">
            <p className="s-title">Available sessions</p>
          </div>

          <div className="sessions-card">
            <table className="sessions-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Location</th>
                  <th>Instructor</th>
                  <th>Spaces</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {DUMMY_SESSIONS.map((session) => {
                  const isBooked = bookedIds.includes(session.id);
                  return (
                    <tr key={session.id}>
                      <td>
                        <div className="cell-icon"><CalendarDays />{session.date}</div>
                      </td>
                      <td className="muted">
                        <div className="cell-icon"><MapPin />{session.location}</div>
                      </td>
                      <td className="muted">
                        <div className="cell-icon"><User />{session.instructor}</div>
                      </td>
                      <td><SeatsBadge seats={isBooked ? session.seatsLeft - 1 : session.seatsLeft} /></td>
                      <td style={{ textAlign: "right" }}>
                        {isBooked ? (
                          <span className="booked-label"><CheckCircle />Booked</span>
                        ) : (
                          <button
                            className="book-btn"
                            onClick={() => handleBook(session)}
                            disabled={session.seatsLeft === 0}
                          >
                            Book now
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {/* ── Booking confirmation modal ── */}
      {showModal && bookedSession && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(false)}><X /></button>

            <div className="modal-icon"><CheckCircle /></div>
            <h2>You're booked!</h2>
            <p>Your spot has been reserved. See you there.</p>

            <div className="modal-summary">
              <div className="ms-row"><BookOpen /><span><strong>{course.title}</strong></span></div>
              <div className="ms-row"><CalendarDays /><span>{bookedSession.date}</span></div>
              <div className="ms-row"><MapPin /><span>{bookedSession.location}</span></div>
              <div className="ms-row"><User /><span>{bookedSession.instructor}</span></div>
              <div className="ms-row"><Clock /><span>{bookedSession.duration}</span></div>
            </div>

            <button className="modal-btn" onClick={() => setShowModal(false)}>Done</button>
          </div>
        </div>
      )}
    </>
  );
}
