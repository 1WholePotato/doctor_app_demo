import { supabase } from "../supabaseClient";
import { fetchInstructors, type Instructor } from "./instructors";
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

export async function findInstructorIdByEmail(email: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("instructors")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (error || !data) return null;
  return data.id;
}

export async function ensureInstructorRecord(user: {
  first_name: string;
  last_name: string;
  email: string;
  cell_num: string | null;
}): Promise<{ instructorId: string; error: string | null }> {
  const existingId = await findInstructorIdByEmail(user.email);
  if (existingId) {
    const { error } = await supabase
      .from("instructors")
      .update({
        first_name: user.first_name,
        last_name: user.last_name,
        cell_num: user.cell_num || "0000000000",
        active: true,
      })
      .eq("id", existingId);

    if (error) return { instructorId: existingId, error: error.message };
    return { instructorId: existingId, error: null };
  }

  const { data, error } = await supabase
    .from("instructors")
    .insert({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      cell_num: user.cell_num || "0000000000",
      active: true,
    })
    .select("id")
    .single();

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
    return {
      error: insertError.message,
      tableMissing: isMissingInstructorCoursesTable(insertError.message),
    };
  }

  return { error: null, tableMissing: false };
}

export async function grantInstructorCourse(
  instructorId: string,
  courseId: string,
): Promise<string | null> {
  const { data, error: lookupError } = await supabase
    .from("instructor_courses")
    .select("id")
    .eq("instructor_id", instructorId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (lookupError) {
    if (isMissingInstructorCoursesTable(lookupError.message)) return null;
    return lookupError.message;
  }

  if (data) return null;

  const { error } = await supabase
    .from("instructor_courses")
    .insert({ instructor_id: instructorId, course_id: courseId });

  if (error) {
    if (isMissingInstructorCoursesTable(error.message)) return null;
    return error.message;
  }

  return null;
}

export async function fetchInstructorsForCourse(courseId: string): Promise<{
  instructors: Instructor[];
  error: string | null;
}> {
  const all = await fetchInstructors();
  if (all.error) return all;

  const { data, error } = await supabase
    .from("instructor_courses")
    .select("instructor_id")
    .eq("course_id", courseId);

  if (error) {
    if (isMissingInstructorCoursesTable(error.message)) return all;
    return { instructors: [], error: error.message };
  }

  const allowed = new Set((data ?? []).map((row) => row.instructor_id));
  if (allowed.size === 0) {
    return all;
  }

  return {
    instructors: all.instructors.filter((instructor) => allowed.has(instructor.id)),
    error: null,
  };
}
