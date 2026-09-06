/**
 * AdminGrades.tsx — Admin-facing grades management page
 *
 * Features:
 * - Table of all students + their enrolled courses
 * - Inline status dropdown: Busy / Passed / Failed
 * - Upload certificate PDF per student (file picker, stores to Supabase Storage)
 * - Filter by course or status
 * - Download uploaded cert to verify it
 *
 * Supabase wiring (when ready):
 *
 * FETCH:
 *   const { data } = await supabase
 *     .from("enrollments")
 *     .select("*, users(first_name, last_name, email), courses(title, category)")
 *     .order("created_at", { ascending: false });
 *
 * UPDATE STATUS:
 *   await supabase
 *     .from("enrollments")
 *     .update({ status: newStatus })
 *     .eq("id", enrollmentId);
 *
 * UPLOAD CERT:
 *   const { data } = await supabase.storage
 *     .from("certificates")
 *     .upload(`${enrollmentId}/${file.name}`, file, { upsert: true });
 *   const url = supabase.storage.from("certificates").getPublicUrl(data.path).data.publicUrl;
 *   await supabase.from("enrollments").update({ certificate_url: url }).eq("id", enrollmentId);
 *
 * NPM: lucide-react (already installed)
 */

import React, { useState, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BookOpen, Users, LayoutDashboard, Settings, LogOut,
  GraduationCap, Upload, Download, CheckCircle, XCircle,
  Clock, Search, ChevronDown, FileCheck, X,
} from "lucide-react";

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = `
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

  .ag-shell * { box-sizing: border-box; margin: 0; padding: 0; }
  .ag-shell { font-family: var(--font-body); background: var(--bg); min-height: 100vh; display: flex; }

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

  .ag-main { margin-left: 228px; flex: 1; padding: 40px 44px; }

  /* Header */
  .ag-header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 28px; }
  .ag-header-left .eyebrow { font-size: 12px; font-weight: 500; color: var(--text-3); letter-spacing: .08em; text-transform: uppercase; margin-bottom: 6px; }
  .ag-header-left h1 { font-family: var(--font-display); font-size: 32px; font-weight: 300; color: var(--text-1); letter-spacing: -.01em; }

  /* Stats */
  .ag-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 28px; }
  .ag-stat { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px 22px; opacity: 0; animation: fadeUp .35s ease forwards; }
  .ag-stat:nth-child(1) { animation-delay: .05s; border-top: 2.5px solid var(--gold); }
  .ag-stat:nth-child(2) { animation-delay: .11s; border-top: 2.5px solid #8DC8A4; }
  .ag-stat:nth-child(3) { animation-delay: .17s; border-top: 2.5px solid #E08080; }
  .ag-stat-label { font-size: 11px; font-weight: 500; color: var(--text-3); letter-spacing: .06em; text-transform: uppercase; margin-bottom: 6px; }
  .ag-stat-val { font-family: var(--font-display); font-size: 30px; font-weight: 300; color: var(--text-1); }

  /* Toolbar */
  .ag-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
  .ag-search-wrap { position: relative; flex: 1; min-width: 200px; max-width: 300px; }
  .ag-search-wrap svg { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); width: 14px; height: 14px; color: var(--text-3); }
  .ag-search { width: 100%; border: 1px solid var(--border); border-radius: 9px; padding: 9px 12px 9px 32px; font-family: var(--font-body); font-size: 13px; color: var(--text-1); background: var(--surface); outline: none; }
  .ag-search:focus { border-color: var(--gold); }
  .ag-filter { border: 1px solid var(--border); border-radius: 9px; padding: 9px 12px; font-family: var(--font-body); font-size: 13px; color: var(--text-2); background: var(--surface); outline: none; cursor: pointer; }
  .ag-filter:focus { border-color: var(--gold); }

  /* Table */
  .ag-table-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; opacity: 0; animation: fadeUp .35s ease .2s forwards; }
  .ag-table { width: 100%; border-collapse: collapse; }
  .ag-table thead th { padding: 12px 18px; font-size: 11px; font-weight: 500; letter-spacing: .08em; text-transform: uppercase; color: var(--text-3); border-bottom: 1px solid var(--border); text-align: left; background: #FAFAF8; white-space: nowrap; }
  .ag-table tbody tr { border-bottom: 1px solid var(--border); transition: background .12s; }
  .ag-table tbody tr:last-child { border-bottom: none; }
  .ag-table tbody tr:hover { background: #FAFAF8; }
  .ag-table tbody td { padding: 14px 18px; font-size: 13px; color: var(--text-1); vertical-align: middle; }
  .ag-table tbody td.muted { color: var(--text-2); font-size: 12px; }

  /* Student cell */
  .student-cell { display: flex; flex-direction: column; gap: 2px; }
  .student-name { font-size: 13px; font-weight: 500; color: var(--text-1); }
  .student-email { font-size: 11px; color: var(--text-3); }

  /* Status select */
  .status-select-wrap { position: relative; display: inline-block; }
  .status-select {
    appearance: none; border: 1px solid var(--border); border-radius: 8px;
    padding: 6px 28px 6px 10px; font-family: var(--font-body); font-size: 12px;
    font-weight: 500; cursor: pointer; outline: none; transition: border-color .15s;
    background: var(--bg);
  }
  .status-select:focus { border-color: var(--gold); }
  .status-select.busy   { color: #D97706; background: #FFFBEB; border-color: #FCD34D; }
  .status-select.passed { color: #1A9E8C; background: #E6F7F5; border-color: #6DD4C8; }
  .status-select.failed { color: #DC2626; background: #FEE9E9; border-color: #FCA5A5; }
  .status-chevron { position: absolute; right: 7px; top: 50%; transform: translateY(-50%); width: 12px; height: 12px; pointer-events: none; color: var(--text-3); }

  /* Upload / cert cell */
  .cert-cell { display: flex; align-items: center; gap: 8px; }
  .upload-btn { display: inline-flex; align-items: center; gap: 5px; background: var(--gold-soft); color: #7A5E1A; border: 1px solid #DFC070; padding: 6px 12px; border-radius: 8px; font-family: var(--font-body); font-size: 12px; font-weight: 500; cursor: pointer; transition: background .15s; white-space: nowrap; }
  .upload-btn:hover { background: #EDD88A; }
  .upload-btn svg { width: 13px; height: 13px; }
  .cert-uploaded { display: inline-flex; align-items: center; gap: 5px; }
  .cert-dl-btn { display: inline-flex; align-items: center; gap: 5px; background: #E9F5EE; color: #2E7D52; border: 1px solid #A8D5B8; padding: 6px 11px; border-radius: 8px; font-size: 12px; font-weight: 500; cursor: pointer; text-decoration: none; transition: background .15s; white-space: nowrap; }
  .cert-dl-btn:hover { background: #D4EEDd; }
  .cert-dl-btn svg { width: 13px; height: 13px; }
  .cert-remove-btn { background: none; border: none; cursor: pointer; color: var(--text-3); padding: 4px; border-radius: 6px; display: flex; align-items: center; transition: color .15s; }
  .cert-remove-btn:hover { color: #DC2626; }
  .cert-remove-btn svg { width: 14px; height: 14px; }
  .cert-pending { font-size: 11px; color: var(--text-3); font-style: italic; }

  /* Toast notification */
  .toast {
    position: fixed; bottom: 28px; right: 28px; z-index: 200;
    background: var(--sidebar); color: #fff; padding: 12px 20px; border-radius: 10px;
    font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 8px;
    box-shadow: 0 8px 24px rgba(0,0,0,.2);
    animation: slideInToast .2s ease;
  }
  .toast svg { width: 16px; height: 16px; color: var(--gold); }
  @keyframes slideInToast { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

  @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
`;

// ─── Types & data ─────────────────────────────────────────────────────────────

type Status = "busy" | "passed" | "failed";

interface Enrollment {
  id: number;
  studentName: string;
  studentEmail: string;
  courseTitle: string;
  category: string;
  sessionDate: string;
  status: Status;
  certificateUrl: string | null;
  certificateName: string | null;
}

const DUMMY: Enrollment[] = [
  { id: 1, studentName: "John Doe",     studentEmail: "john@example.com",   courseTitle: "CPR Training",           category: "Emergency",    sessionDate: "10 Apr 2026", status: "passed", certificateUrl: "/certs/john-cpr.pdf",   certificateName: "john-cpr.pdf" },
  { id: 2, studentName: "Pieter van W", studentEmail: "pieter@example.com", courseTitle: "CPR Training",           category: "Emergency",    sessionDate: "10 Apr 2026", status: "busy",   certificateUrl: null,                    certificateName: null },
  { id: 3, studentName: "Sarah Nkosi",  studentEmail: "sarah@example.com",  courseTitle: "Advanced Anatomy",       category: "Anatomy",      sessionDate: "22 Apr 2026", status: "passed", certificateUrl: null,                    certificateName: null },
  { id: 4, studentName: "Gielie Botha", studentEmail: "gielie@example.com", courseTitle: "Advanced Anatomy",       category: "Anatomy",      sessionDate: "22 Apr 2026", status: "failed", certificateUrl: null,                    certificateName: null },
  { id: 5, studentName: "John Doe",     studentEmail: "john@example.com",   courseTitle: "Clinical Pharmacology",  category: "Pharmacology", sessionDate: "28 Apr 2026", status: "busy",   certificateUrl: null,                    certificateName: null },
  { id: 6, studentName: "Sarah Nkosi",  studentEmail: "sarah@example.com",  courseTitle: "First Aid Crash Course", category: "Emergency",    sessionDate: "15 Apr 2026", status: "passed", certificateUrl: "/certs/sarah-fa.pdf",   certificateName: "sarah-fa.pdf" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function NavItem({ to, icon: Icon, label, active }: { to: string; icon: React.ElementType; label: string; active: boolean }) {
  return (
    <Link to={to} className={`nav-item${active ? " active" : ""}`}>
      <Icon />{label}
    </Link>
  );
}

function StatusIcon({ status }: { status: Status }) {
  if (status === "passed") return <CheckCircle size={14} color="#1A9E8C" />;
  if (status === "failed") return <XCircle     size={14} color="#DC2626" />;
  return <Clock size={14} color="#D97706" />;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminGrades() {
  const { pathname } = useLocation();
  const [enrollments, setEnrollments] = useState<Enrollment[]>(DUMMY);
  const [search,      setSearch]      = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | Status>("all");
  const [filterCourse, setFilterCourse] = useState("all");
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleStatusChange = (id: number, newStatus: Status) => {
    setEnrollments(prev =>
      prev.map(e => e.id === id ? { ...e, status: newStatus } : e)
    );
    showToast("Status updated successfully");
    // Supabase: await supabase.from("enrollments").update({ status: newStatus }).eq("id", id);
  };

  const handleFileUpload = (id: number, file: File) => {
    const fakeUrl = URL.createObjectURL(file);
    setEnrollments(prev =>
      prev.map(e => e.id === id ? { ...e, certificateUrl: fakeUrl, certificateName: file.name } : e)
    );
    showToast(`Certificate uploaded for ${enrollments.find(e => e.id === id)?.studentName}`);
    // Supabase Storage:
    // const { data } = await supabase.storage.from("certificates").upload(`${id}/${file.name}`, file, { upsert: true });
    // const url = supabase.storage.from("certificates").getPublicUrl(data.path).data.publicUrl;
    // await supabase.from("enrollments").update({ certificate_url: url }).eq("id", id);
  };

  const handleRemoveCert = (id: number) => {
    setEnrollments(prev =>
      prev.map(e => e.id === id ? { ...e, certificateUrl: null, certificateName: null } : e)
    );
    showToast("Certificate removed");
    // Supabase: await supabase.from("enrollments").update({ certificate_url: null }).eq("id", id);
  };

  // ── Filter ───────────────────────────────────────────────────────────────────

  const courses = [...new Set(DUMMY.map(e => e.courseTitle))];

  const filtered = enrollments.filter(e => {
    const matchSearch = e.studentName.toLowerCase().includes(search.toLowerCase()) ||
                        e.studentEmail.toLowerCase().includes(search.toLowerCase()) ||
                        e.courseTitle.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || e.status === filterStatus;
    const matchCourse = filterCourse === "all" || e.courseTitle === filterCourse;
    return matchSearch && matchStatus && matchCourse;
  });

  const passedCount = enrollments.filter(e => e.status === "passed").length;
  const busyCount   = enrollments.filter(e => e.status === "busy").length;
  const failedCount = enrollments.filter(e => e.status === "failed").length;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{styles}</style>
      <div className="ag-shell">

        {/* ── Sidebar ── */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <BookOpen size={20} color="var(--gold)" />
            Dr <span>Admin</span>
          </div>
          <nav className="sidebar-nav">
            <p className="nav-section-label">Main</p>
            <NavItem to="/dashboard"    icon={LayoutDashboard} label="Dashboard" active={pathname === "/dashboard"} />
            <NavItem to="/admincourses" icon={BookOpen}        label="Courses"   active={pathname.startsWith("/admincourses")} />
            <NavItem to="/patients"     icon={Users}           label="Students"  active={pathname.startsWith("/patients")} />
            <NavItem to="/adminGrades"  icon={GraduationCap}   label="Grades"    active={pathname.startsWith("/adminGrades")} />
            <p className="nav-section-label">Account</p>
            <NavItem to="/settings"     icon={Settings}        label="Settings"  active={pathname.startsWith("/settings")} />
          </nav>
          <div className="sidebar-footer">
            <button className="nav-item" style={{ color: "#665F5C" }}><LogOut />Sign out</button>
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="ag-main">
          <div className="ag-header">
            <div className="ag-header-left">
              <p className="eyebrow">Academic records</p>
              <h1>Student grades</h1>
            </div>
          </div>

          {/* Stats */}
          <div className="ag-stats">
            <div className="ag-stat">
              <p className="ag-stat-label">In progress</p>
              <p className="ag-stat-val">{busyCount}</p>
            </div>
            <div className="ag-stat">
              <p className="ag-stat-label">Passed</p>
              <p className="ag-stat-val">{passedCount}</p>
            </div>
            <div className="ag-stat">
              <p className="ag-stat-label">Failed</p>
              <p className="ag-stat-val">{failedCount}</p>
            </div>
          </div>

          {/* Toolbar */}
          <div className="ag-toolbar">
            <div className="ag-search-wrap">
              <Search />
              <input
                className="ag-search"
                placeholder="Search student or course…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <select className="ag-filter" value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
              <option value="all">All statuses</option>
              <option value="busy">In progress</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
            </select>

            <select className="ag-filter" value={filterCourse} onChange={e => setFilterCourse(e.target.value)}>
              <option value="all">All courses</option>
              {courses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Table */}
          <div className="ag-table-card">
            <table className="ag-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Course</th>
                  <th>Session date</th>
                  <th>Status</th>
                  <th>Certificate</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id}>

                    {/* Student */}
                    <td>
                      <div className="student-cell">
                        <span className="student-name">{e.studentName}</span>
                        <span className="student-email">{e.studentEmail}</span>
                      </div>
                    </td>

                    {/* Course */}
                    <td className="muted">
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ color: "var(--text-1)", fontWeight: 500 }}>{e.courseTitle}</span>
                        <span style={{ fontSize: 11, color: "var(--text-3)" }}>{e.category}</span>
                      </div>
                    </td>

                    {/* Date */}
                    <td className="muted">{e.sessionDate}</td>

                    {/* Status dropdown */}
                    <td>
                      <div className="status-select-wrap">
                        <select
                          className={`status-select ${e.status}`}
                          value={e.status}
                          onChange={ev => handleStatusChange(e.id, ev.target.value as Status)}
                        >
                          <option value="busy">In progress</option>
                          <option value="passed">Passed</option>
                          <option value="failed">Failed</option>
                        </select>
                        <ChevronDown className="status-chevron" />
                      </div>
                    </td>

                    {/* Certificate upload / download */}
                    <td>
                      <div className="cert-cell">
                        {/* Hidden file input */}
                        <input
                          type="file"
                          accept=".pdf"
                          style={{ display: "none" }}
                          ref={el => { fileInputRefs.current[e.id] = el; }}
                          onChange={ev => {
                            const file = ev.target.files?.[0];
                            if (file) handleFileUpload(e.id, file);
                            ev.target.value = "";
                          }}
                        />

                        {e.certificateUrl ? (
                          <div className="cert-uploaded">
                            <a href={e.certificateUrl} download={e.certificateName} className="cert-dl-btn">
                              <Download />{e.certificateName ?? "Download"}
                            </a>
                            <button
                              className="cert-remove-btn"
                              onClick={() => handleRemoveCert(e.id)}
                              title="Remove certificate"
                            >
                              <X />
                            </button>
                          </div>
                        ) : e.status === "passed" ? (
                          <button
                            className="upload-btn"
                            onClick={() => fileInputRefs.current[e.id]?.click()}
                          >
                            <Upload />Upload cert
                          </button>
                        ) : (
                          <span className="cert-pending">—</span>
                        )}
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {/* Toast */}
      {toast && (
        <div className="toast">
          <FileCheck />
          {toast}
        </div>
      )}
    </>
  );
}
