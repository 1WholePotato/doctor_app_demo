import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  X,
  AlertCircle,
} from "lucide-react";
import { supabase } from "../supabaseClient";
import AdminSidebar from "../components/AdminSidebar";
import { getSessionUser } from "../lib/auth";
import { loadRoles, roleLabel, type RoleOption } from "../lib/roles";
import {
  ensureInstructorRecord,
  fetchAllowedCourseIds,
  fetchAllowedCourseIdsByInstructor,
  fetchCourseOptions,
  findInstructorIdByEmail,
  isInstructorRole,
  setInstructorCourses,
  type CourseOption,
} from "../lib/instructorCourses";

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

  .au-shell * { box-sizing: border-box; margin: 0; padding: 0; }
  .au-shell { font-family: var(--font-body); background: var(--bg); min-height: 100vh; display: flex; }

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

  .au-main { margin-left: 228px; flex: 1; padding: 40px 44px; }
  .au-header { margin-bottom: 28px; }
  .au-header .eyebrow { font-size: 12px; font-weight: 500; color: var(--text-3); letter-spacing: .08em; text-transform: uppercase; margin-bottom: 6px; }
  .au-header h1 { font-family: var(--font-display); font-size: 32px; font-weight: 300; color: var(--text-1); letter-spacing: -.01em; }

  .filter-pills { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
  .filter-pill { padding: 7px 14px; border-radius: 20px; font-size: 13px; font-weight: 500; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); cursor: pointer; transition: background .15s, border-color .15s, color .15s; }
  .filter-pill:hover { border-color: var(--gold); color: var(--text-1); }
  .filter-pill.active { background: var(--gold-soft); border-color: var(--gold); color: #7A5E1A; }

  .table-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
  .table-inner { width: 100%; border-collapse: collapse; }
  .table-inner thead th { padding: 14px 20px; font-size: 11px; font-weight: 500; letter-spacing: .08em; text-transform: uppercase; color: var(--text-3); border-bottom: 1px solid var(--border); text-align: left; background: #FAFAF8; }
  .table-inner tbody tr { border-bottom: 1px solid var(--border); transition: background .12s; }
  .table-inner tbody tr:last-child { border-bottom: none; }
  .table-inner tbody tr:hover { background: #FAFAF8; }
  .table-inner tbody td { padding: 16px 20px; font-size: 14px; color: var(--text-1); }
  .table-inner tbody td.muted { color: var(--text-2); }

  .table-inner tbody td.courses-cell { max-width: 240px; min-width: 0; vertical-align: top; }

  .badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
  .badge-paid { background: #EAF5EE; color: #2E7D52; }
  .badge-pending { background: #FEF4E4; color: #9A6500; }
  .badge-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex-shrink: 0; }

  .btn-link { background: none; border: none; color: var(--gold); font-family: var(--font-body); font-size: 13px; font-weight: 500; cursor: pointer; padding: 0; text-decoration: underline; }
  .btn-link:disabled { color: var(--text-3); cursor: not-allowed; text-decoration: none; }

  .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 20px; text-align: center; }
  .empty-icon { width: 60px; height: 60px; background: var(--gold-soft); border-radius: 16px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; }
  .empty-icon svg { width: 28px; height: 28px; color: var(--gold); }
  .empty-title { font-family: var(--font-display); font-size: 22px; font-weight: 300; color: var(--text-1); margin-bottom: 8px; }
  .empty-sub { font-size: 14px; color: var(--text-3); max-width: 280px; line-height: 1.6; }

  .modal-overlay { position: fixed; inset: 0; background: rgba(17,17,16,.45); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; animation: fadeIn .15s ease; }
  .modal { background: var(--surface); border-radius: 18px; width: 100%; max-width: 560px; padding: 32px; position: relative; animation: slideUp .2s ease; max-height: calc(100vh - 40px); overflow: auto; }
  .modal-close { position: absolute; top: 20px; right: 20px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-2); transition: background .12s; }
  .modal-close:hover { background: var(--border); }
  .modal-close svg { width: 16px; height: 16px; }
  .modal-eyebrow { font-size: 11px; font-weight: 500; color: var(--text-3); letter-spacing: .08em; text-transform: uppercase; margin-bottom: 6px; }
  .modal h2 { font-family: var(--font-display); font-size: 24px; font-weight: 300; color: var(--text-1); margin-bottom: 28px; }

  .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 18px; }
  .field label { font-size: 12px; font-weight: 500; color: var(--text-2); letter-spacing: .04em; text-transform: uppercase; }
  .field select { width: 100%; border: 1px solid var(--border); border-radius: 10px; padding: 11px 14px; font-family: var(--font-body); font-size: 14px; color: var(--text-1); background: #FAFAF8; outline: none; transition: border-color .15s; appearance: none; }
  .field select:focus { border-color: var(--gold); background: #fff; }
  .readonly-block { margin-bottom: 18px; }
  .readonly-label { font-size: 12px; font-weight: 500; color: var(--text-2); letter-spacing: .04em; text-transform: uppercase; margin-bottom: 4px; }
  .readonly-value { font-size: 14px; color: var(--text-1); }
  .readonly-sub { font-size: 13px; color: var(--text-3); margin-top: 2px; }

  .field-error { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #C0392B; margin-bottom: 12px; }
  .field-error svg { width: 13px; height: 13px; }

  .btn-submit { width: 100%; background: var(--text-1); color: #fff; border: none; padding: 13px; border-radius: 10px; font-family: var(--font-body); font-size: 14px; font-weight: 500; cursor: pointer; transition: background .15s; margin-top: 6px; }
  .btn-submit:hover { background: #2a2a28; }
  .btn-submit:disabled { background: var(--text-3); cursor: not-allowed; }

  .course-help { font-size: 13px; color: var(--text-2); line-height: 1.5; margin: -8px 0 14px; }
  .course-list { display: flex; flex-direction: column; gap: 8px; max-height: 220px; overflow: auto; border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; background: #FAFAF8; }
  .course-option { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; color: var(--text-1); cursor: pointer; line-height: 1.4; }
  .course-option input { margin-top: 2px; accent-color: var(--gold); flex-shrink: 0; width: 16px; height: 16px; }
  .course-pills { display: flex; flex-wrap: wrap; gap: 6px; }
  .course-pill { font-size: 11px; font-weight: 500; color: #7A5E1A; background: var(--gold-soft); border: 1px solid #E6D7A8; padding: 3px 8px; border-radius: 20px; }
  .muted-dash { color: var(--text-3); }

  .au-loading { font-size: 14px; color: var(--text-3); padding: 40px 0; }

  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
`;

type UserRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role_id: string;
  active: boolean;
  cell_num: string | null;
};

type StatusFilter = "all" | "active" | "inactive";

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`badge ${active ? "badge-paid" : "badge-pending"}`}>
      <span className="badge-dot" />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((id, index) => id === right[index]);
}

function ChangeRoleModal({
  user,
  roles,
  currentUserId,
  courses,
  onClose,
  onSaved,
}: {
  user: UserRow;
  roles: RoleOption[];
  currentUserId: string;
  courses: CourseOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [roleId, setRoleId] = useState(user.role_id);
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [initialCourseIds, setInitialCourseIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [error, setError] = useState("");
  const [tableMissing, setTableMissing] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const isSelf = user.id === currentUserId;
  const assigningInstructor = isInstructorRole(roleId, roles);

  useEffect(() => {
    let cancelled = false;

    async function loadAssigned() {
      const instructorId = await findInstructorIdByEmail(user.email);
      if (!instructorId) {
        if (!cancelled) setLoadingCourses(false);
        return;
      }

      const result = await fetchAllowedCourseIds(instructorId);
      if (cancelled) return;

      setTableMissing(result.tableMissing);
      if (result.error && !result.tableMissing) setError(result.error);
      setCourseIds(result.courseIds);
      setInitialCourseIds(result.courseIds);
      setLoadingCourses(false);
    }

    void loadAssigned();
    return () => {
      cancelled = true;
    };
  }, [user.email]);

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>("#role-select")?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const toggleCourse = (courseId: string) => {
    setCourseIds((current) =>
      current.includes(courseId)
        ? current.filter((id) => id !== courseId)
        : [...current, courseId],
    );
  };

  const handleSubmit = async () => {
    if (isSelf) return;
    setError("");

    if (assigningInstructor && courseIds.length === 0) {
      setError("Choose at least one course this instructor can give.");
      return;
    }

    setSaving(true);

    const { error: updateError } = await supabase
      .from("users")
      .update({ role_id: roleId })
      .eq("id", user.id);

    if (updateError) {
      setSaving(false);
      setError(updateError.message);
      return;
    }

    if (assigningInstructor) {
      const instructor = await ensureInstructorRecord(user);
      if (instructor.error) {
        setSaving(false);
        setError(instructor.error);
        return;
      }

      const assigned = await setInstructorCourses(instructor.instructorId, courseIds);
      if (assigned.error) {
        setSaving(false);
        setTableMissing(assigned.tableMissing);
        setError(
          assigned.tableMissing
            ? "Run scripts/ensure-instructor-courses.sql in the Supabase SQL editor, then try again."
            : assigned.error,
        );
        return;
      }
    } else {
      const instructorId = await findInstructorIdByEmail(user.email);
      if (instructorId) {
        const cleared = await setInstructorCourses(instructorId, []);
        if (cleared.error && !cleared.tableMissing) {
          setSaving(false);
          setError(cleared.error);
          return;
        }
      }
    }

    setSaving(false);
    onSaved();
    onClose();
  };

  const unchanged =
    roleId === user.role_id &&
    sameIds(courseIds, initialCourseIds);

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="role-modal-title">
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X />
        </button>

        <p className="modal-eyebrow">Change role</p>
        <h2 id="role-modal-title">{user.first_name} {user.last_name}</h2>

        <div className="readonly-block">
          <p className="readonly-label">Name</p>
          <p className="readonly-value">
            {user.first_name} {user.last_name}
          </p>
        </div>
        <div className="readonly-block">
          <p className="readonly-label">Email</p>
          <p className="readonly-value">{user.email}</p>
        </div>

        {isSelf ? (
          <div className="field-error" role="alert">
            <AlertCircle />
            You cannot change your own role.
          </div>
        ) : (
          <>
            <div className="field">
              <label htmlFor="role-select">Role</label>
              <select
                id="role-select"
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            {assigningInstructor && (
              <fieldset className="field" style={{ border: "none", padding: 0, margin: 0 }}>
                <legend className="readonly-label" style={{ marginBottom: 6 }}>Courses they can give</legend>
                <p className="course-help">
                  Instructors only appear as teachers on the courses you select here.
                </p>
                {tableMissing && (
                  <div className="field-error" role="alert">
                    <AlertCircle />
                    Run scripts/ensure-instructor-courses.sql in the Supabase SQL editor first.
                  </div>
                )}
                {loadingCourses ? (
                  <p className="readonly-sub">Loading courses…</p>
                ) : courses.length === 0 ? (
                  <p className="readonly-sub">Create a course before assigning an instructor.</p>
                ) : (
                  <div className="course-list">
                    {courses.map((course) => {
                      const inputId = `course-${course.id}`;
                      return (
                        <label key={course.id} htmlFor={inputId} className="course-option">
                          <input
                            id={inputId}
                            type="checkbox"
                            checked={courseIds.includes(course.id)}
                            onChange={() => toggleCourse(course.id)}
                          />
                          {course.title}
                        </label>
                      );
                    })}
                  </div>
                )}
              </fieldset>
            )}
          </>
        )}

        {error && (
          <div className="field-error" role="alert">
            <AlertCircle />
            {error}
          </div>
        )}

        <button
          type="button"
          className="btn-submit"
          disabled={isSelf || saving || unchanged || tableMissing}
          onClick={() => void handleSubmit()}
        >
          {saving ? "Saving…" : assigningInstructor ? "Save role and courses" : "Save role"}
        </button>
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [coursesByEmail, setCoursesByEmail] = useState<Map<string, string[]>>(new Map());
  const [currentUserId, setCurrentUserId] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [loadError, setLoadError] = useState("");

  const fetchUsers = useCallback(async () => {
    const [{ data, error }, courseResult, assignmentResult, instructorsResult] = await Promise.all([
      supabase
        .from("users")
        .select("id, first_name, last_name, email, role_id, active, cell_num")
        .order("last_name"),
      fetchCourseOptions(),
      fetchAllowedCourseIdsByInstructor(),
      supabase.from("instructors").select("id, email"),
    ]);

    if (error) {
      setLoadError(error.message);
      return;
    }

    setUsers((data ?? []) as UserRow[]);
    setCourses(courseResult.courses);

    const emailByInstructorId = new Map(
      (instructorsResult.data ?? []).map((row) => [row.id, row.email]),
    );
    const next = new Map<string, string[]>();
    for (const [instructorId, courseIds] of assignmentResult.byInstructorId) {
      const email = emailByInstructorId.get(instructorId);
      if (email) next.set(email, courseIds);
    }
    setCoursesByEmail(next);

    const messages = [
      courseResult.error,
      assignmentResult.tableMissing
        ? "Instructor course assignments need scripts/ensure-instructor-courses.sql run in the SQL editor."
        : assignmentResult.error,
      instructorsResult.error?.message,
    ].filter((message): message is string => Boolean(message));

    setLoadError(messages[0] ?? "");
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const sessionUser = await getSessionUser();
      if (cancelled) return;

      if (!sessionUser) {
        navigate("/login");
        return;
      }

      setCurrentUserId(sessionUser.id);
      const loadedRoles = await loadRoles();
      if (cancelled) return;

      setRoles(loadedRoles);
      await fetchUsers();
      if (!cancelled) setLoading(false);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [navigate, fetchUsers]);

  const filtered = users.filter((u) => {
    if (filter === "active") return u.active;
    if (filter === "inactive") return !u.active;
    return true;
  });

  const courseTitle = (courseId: string) =>
    courses.find((course) => course.id === courseId)?.title ?? "Course";

  if (loading) {
    return (
      <>
        <style>{globalStyles}</style>
        <div className="au-shell">
          <AdminSidebar />
          <main className="au-main">
            <p className="au-loading">Loading users…</p>
          </main>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{globalStyles}</style>
      <div className="au-shell">
        <AdminSidebar />

        <main className="au-main">
          <header className="au-header">
            <p className="eyebrow">People</p>
            <h1>Users</h1>
          </header>

          <div className="filter-pills">
            {(["all", "active", "inactive"] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={`filter-pill${filter === f ? " active" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "All" : f === "active" ? "Active" : "Inactive"}
              </button>
            ))}
          </div>

          {loadError && (
            <div className="field-error" role="alert" style={{ marginBottom: 16 }}>
              <AlertCircle />
              {loadError}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <Users />
              </div>
              <p className="empty-title">No users found</p>
              <p className="empty-sub">
                {filter === "all"
                  ? "There are no users in the system yet."
                  : `No ${filter} users match this filter.`}
              </p>
            </div>
          ) : (
            <div className="table-card">
              <table className="table-inner">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Courses</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => {
                    const assigned = isInstructorRole(u.role_id, roles)
                      ? coursesByEmail.get(u.email) ?? []
                      : [];
                    return (
                      <tr key={u.id}>
                        <td>
                          {u.first_name} {u.last_name}
                        </td>
                        <td className="muted">{u.email}</td>
                        <td className="muted">{roleLabel(u.role_id, roles)}</td>
                        <td className="courses-cell">
                          {assigned.length === 0 ? (
                            <span className="muted-dash">—</span>
                          ) : (
                            <div className="course-pills">
                              {assigned.map((courseId) => (
                                <span key={courseId} className="course-pill">
                                  {courseTitle(courseId)}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td>
                          <StatusBadge active={u.active} />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn-link"
                            disabled={u.id === currentUserId}
                            onClick={() => setSelected(u)}
                          >
                            Change role
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {selected && (
        <ChangeRoleModal
          user={selected}
          roles={roles}
          courses={courses}
          currentUserId={currentUserId}
          onClose={() => setSelected(null)}
          onSaved={() => void fetchUsers()}
        />
      )}
    </>
  );
}
