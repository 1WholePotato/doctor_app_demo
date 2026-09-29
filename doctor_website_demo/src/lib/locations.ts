import { supabase } from "../supabaseClient";

export type LocationRow = {
  id: string;
  name: string;
  address: string | null;
};

export async function fetchLocations(): Promise<{ locations: LocationRow[]; error: string | null }> {
  const { data, error } = await supabase.from("locations").select("id, name, address").order("name");
  if (error) return { locations: [], error: error.message };
  return { locations: (data ?? []) as LocationRow[], error: null };
}

export async function firstLocationId(): Promise<string | null> {
  const { locations } = await fetchLocations();
  return locations[0]?.id ?? null;
}
