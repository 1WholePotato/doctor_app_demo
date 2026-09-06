import { supabase } from "../supabaseClient";
import { isAdminRole, loadRoles } from "./roles";

export type AppUser = {
  id: string;
  email: string;
  role_id: string;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  id_num: string | null;
  passport_num: string | null;
  cell_num: string | null;
  sanc_num: string | null;
  active: boolean;
};

export async function getSessionUser(): Promise<AppUser | null> {
  const { data: sessionData } = await supabase.auth.getUser();
  const authUser = sessionData.user;
  if (!authUser) return null;

  await loadRoles();

  const { data, error } = await supabase
    .from("users")
    .select(
      "id, email, role_id, first_name, last_name, birth_date, id_num, passport_num, cell_num, sanc_num, active"
    )
    .eq("id", authUser.id)
    .single();

  if (error || !data) return null;
  return data as AppUser;
}

export function homeForRole(roleId: string, roleName?: string | null): string {
  return isAdminRole(roleId, roleName) ? "/dashboard" : "/studentlanding";
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
