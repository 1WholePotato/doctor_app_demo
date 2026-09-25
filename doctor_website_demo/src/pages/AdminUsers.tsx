import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  X,
  AlertCircle,
} from "lucide-react";
import { supabase } from "../supabaseClient";
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
                    Instructor course assignment is temporarily unavailable. Please contact the administrator.
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
        <main className="au-main">
          <p className="au-loading">Loading users…</p>
        </main>
      </>
    );
  }

  return (
    <>
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
