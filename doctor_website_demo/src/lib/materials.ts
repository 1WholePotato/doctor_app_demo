import { supabase } from "../supabaseClient";

export type MaterialOption = {
  id: string;
  name: string;
  fee: number;
  total: number;
};

type MaterialPriceRow = {
  material_type_id: string;
  name: string;
  material_fee: number | string;
  total_amount: number | string;
};

export async function fetchMaterialOptions(courseId: string): Promise<{ options: MaterialOption[]; error: string | null }> {
  const { data, error } = await supabase.rpc("course_material_prices", { p_course_id: courseId });
  if (error) return { options: [], error: error.message };
  const options = ((data ?? []) as MaterialPriceRow[]).map((row) => ({
    id: row.material_type_id,
    name: row.name,
    fee: Number(row.material_fee),
    total: Number(row.total_amount),
  }));
  return { options, error: null };
}
