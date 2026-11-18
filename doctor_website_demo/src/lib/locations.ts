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

export async function createLocation(name: string, address: string): Promise<{ location: LocationRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from("locations")
    .insert({ name: name.trim(), address: address.trim() || null })
    .select("id, name, address")
    .single<LocationRow>();
  if (error) {
    return { location: null, error: error.code === "23505" ? `A location named "${name.trim()}" already exists.` : error.message };
  }
  return { location: data, error: null };
}

export function locationLabel(location: Pick<LocationRow, "name" | "address">): string {
  return location.address ? `${location.name}, ${location.address}` : location.name;
}
