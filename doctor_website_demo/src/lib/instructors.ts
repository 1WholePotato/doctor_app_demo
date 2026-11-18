import { supabase } from "../supabaseClient";

export type Instructor = {
  id: string;
  user_id?: string | null;
  first_name: string;
  last_name: string;
  email: string;
  cell_num?: string;
};

export function instructorName(instructor: Pick<Instructor, "first_name" | "last_name" | "email">): string {
  const combined = `${instructor.first_name} ${instructor.last_name}`.trim();
  return combined || instructor.email;
}

export const SESSION_INSTRUCTORS_EMBED = "instructors!session_instructors ( first_name, last_name, email )";

type InstructorNameFields = Pick<Instructor, "first_name" | "last_name" | "email">;

function isInstructorNameFields(value: unknown): value is InstructorNameFields {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return ["first_name", "last_name", "email"].every((key) => typeof record[key] === "string");
}

export function instructorNames(embedded: unknown, fallback: string): string {
  const names = (Array.isArray(embedded) ? embedded : [embedded])
    .filter(isInstructorNameFields)
    .map(instructorName)
    .sort((a, b) => a.localeCompare(b));
  return names.length > 0 ? names.join(", ") : fallback;
}

export async function fetchInstructors(): Promise<{ instructors: Instructor[]; error: string | null }> {
  const { data, error } = await supabase
    .from("instructors")
    .select("id, first_name, last_name, email")
    .eq("active", true)
    .order("last_name");

  if (error) {
    return { instructors: [], error: error.message };
  }

  return { instructors: (data ?? []) as Instructor[], error: null };
}
