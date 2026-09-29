import { supabase } from "../supabaseClient";

export type Instructor = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  cell_num?: string;
};

export function instructorName(instructor: Pick<Instructor, "first_name" | "last_name" | "email">): string {
  const combined = `${instructor.first_name} ${instructor.last_name}`.trim();
  return combined || instructor.email;
}

export async function fetchInstructors(): Promise<{ instructors: Instructor[]; error: string | null }> {
  const { data, error } = await supabase
    .from("instructors")
    .select("id, first_name, last_name, email")
    .order("last_name");

  if (error) {
    return { instructors: [], error: error.message };
  }

  return { instructors: (data ?? []) as Instructor[], error: null };
}
