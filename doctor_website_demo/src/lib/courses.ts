import { supabase } from "../supabaseClient";

export type CourseDraft = {
  title: string;
  description: string;
  price: number;
  active: boolean;
};

export function courseProblem(draft: CourseDraft): string | null {
  if (!draft.title.trim()) return "Course title is required.";
  if (!Number.isFinite(draft.price) || draft.price <= 0) return "Enter a price above zero.";
  return null;
}

function courseColumns(draft: CourseDraft) {
  return {
    course_title: draft.title.trim(),
    course_description: draft.description.trim(),
    course_price: draft.price,
    active: draft.active,
  };
}

export async function createCourse(draft: CourseDraft): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase.from("courses").insert(courseColumns(draft)).select("id").single<{ id: string }>();
  return { id: data?.id ?? null, error: error?.message ?? null };
}

export async function updateCourse(id: string, draft: CourseDraft): Promise<string | null> {
  const { error } = await supabase.from("courses").update(courseColumns(draft)).eq("id", id);
  return error?.message ?? null;
}
