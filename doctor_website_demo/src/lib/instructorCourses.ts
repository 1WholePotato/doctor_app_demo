import { supabase } from "../supabaseClient";
import type { Instructor } from "./instructors";
import type { RoleOption } from "./roles";

export type CourseOption = {
  id: string;
  title: string;
};

export function isInstructorRole(
  roleId: string,
  roles: RoleOption[],
): boolean {
  const match = roles.find((role) => role.id === roleId);
  return Boolean(match?.name.toLowerCase().includes("instructor"));
}

export function isMissingInstructorCoursesTable(message: string | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return lower.includes("instructor_courses") && (
    lower.includes("schema cache") ||
    lower.includes("does not exist") ||
    lower.includes("could not find the table")
  );
}

export async function fetchCourseOptions(): Promise<{ courses: CourseOption[]; error: string | null }> {
  const { data, error } = await supabase
    .from("courses")
    .select("id, course_title")
    .eq("active", true)
    .order("course_title");

  if (error) {
    return { courses: [], error: error.message };
  }

  return {
    courses: (data ?? []).map((row) => ({ id: row.id, title: row.course_title })),
    error: null,
  };
}

type InstructorAccount = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  cell_num: string | null;
};

export async function findInstructorIdForUser(
  user: Pick<InstructorAccount, "id" | "email">,
): Promise<{ id: string | null; error: string | null }> {
  const linked = await supabase.from("instructors").select("id").eq("user_id", user.id).maybeSingle();
  if (linked.error) return { id: null, error: linked.error.message };
  if (linked.data) return { id: linked.data.id, error: null };

  const unlinked = await supabase
    .from("instructors")
    .select("id")
    .is("user_id", null)
    .eq("email", user.email)
    .maybeSingle();
  if (unlinked.error) return { id: null, error: unlinked.error.message };
  return { id: unlinked.data?.id ?? null, error: null };
}

export async function ensureInstructorRecord(user: InstructorAccount): Promise<{ instructorId: string; error: string | null }> {
  const existing = await findInstructorIdForUser(user);
  if (existing.error) return { instructorId: "", error: existing.error };
  const profile = {
    user_id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    cell_num: user.cell_num || "0000000000",
    active: true,
  };
  const existingId = existing.id;
  if (existingId) {
    const { error } = await supabase.from("instructors").update(profile).eq("id", existingId);
    return { instructorId: existingId, error: error?.message ?? null };
  }

  const { data, error } = await supabase.from("instructors").insert(profile).select("id").single();

  if (error || !data) {
    return { instructorId: "", error: error?.message ?? "Could not create instructor" };
  }

  return { instructorId: data.id, error: null };
}

export async function fetchAllowedCourseIds(
  instructorId: string,
): Promise<{ courseIds: string[]; error: string | null; tableMissing: boolean }> {
  const { data, error } = await supabase
    .from("instructor_courses")
    .select("course_id")
    .eq("instructor_id", instructorId);

  if (error) {
    return {
      courseIds: [],
      error: error.message,
      tableMissing: isMissingInstructorCoursesTable(error.message),
    };
  }

  return {
    courseIds: (data ?? []).map((row) => row.course_id),
    error: null,
    tableMissing: false,
  };
}

export async function fetchAllowedCourseIdsByInstructor(): Promise<{
  byInstructorId: Map<string, string[]>;
  error: string | null;
  tableMissing: boolean;
}> {
  const { data, error } = await supabase
    .from("instructor_courses")
    .select("instructor_id, course_id");

  if (error) {
    return {
      byInstructorId: new Map(),
      error: error.message,
      tableMissing: isMissingInstructorCoursesTable(error.message),
    };
  }

  const byInstructorId = new Map<string, string[]>();
  for (const row of data ?? []) {
    const list = byInstructorId.get(row.instructor_id) ?? [];
    list.push(row.course_id);
    byInstructorId.set(row.instructor_id, list);
  }

  return { byInstructorId, error: null, tableMissing: false };
}

export async function setInstructorCourses(
  instructorId: string,
  courseIds: string[],
): Promise<{ error: string | null; tableMissing: boolean }> {
  const previous = await fetchAllowedCourseIds(instructorId);
  if (previous.error) return { error: previous.error, tableMissing: previous.tableMissing };

  const { error: deleteError } = await supabase
    .from("instructor_courses")
    .delete()
    .eq("instructor_id", instructorId);

  if (deleteError) {
    return {
      error: deleteError.message,
      tableMissing: isMissingInstructorCoursesTable(deleteError.message),
    };
  }

  const uniqueIds = [...new Set(courseIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { error: null, tableMissing: false };
  }

  const { error: insertError } = await supabase.from("instructor_courses").insert(
    uniqueIds.map((courseId) => ({ instructor_id: instructorId, course_id: courseId })),
  );

  if (insertError) {
    const { error: restoreError } = await supabase
      .from("instructor_courses")
      .insert(previous.courseIds.map((courseId) => ({ instructor_id: instructorId, course_id: courseId })));
    return {
      error: restoreError
        ? `${insertError.message}. Previous assignments could not be restored: ${restoreError.message}`
        : insertError.message,
      tableMissing: isMissingInstructorCoursesTable(insertError.message),
    };
  }

  return { error: null, tableMissing: false };
}

export async function fetchInstructorsForCourse(courseId: string): Promise<{
  instructors: Instructor[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("instructors")
    .select("id, first_name, last_name, email, instructor_courses!inner ( course_id )")
    .eq("active", true)
    .eq("instructor_courses.course_id", courseId)
    .order("last_name");

  if (error) return { instructors: [], error: error.message };
  return {
    instructors: (data ?? []).map(({ id, first_name, last_name, email }) => ({ id, first_name, last_name, email })),
    error: null,
  };
}

export async function setSessionInstructors(sessionId: string, instructorIds: string[]): Promise<string | null> {
  const { error } = await supabase.rpc("set_session_instructors", {
    p_course_session_id: sessionId,
    p_instructor_ids: instructorIds,
  });
  return error?.message ?? null;
}
