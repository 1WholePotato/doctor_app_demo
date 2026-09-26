import { supabase } from "../supabaseClient";
import { isAdminRole, loadRoles, resolveStudentRoleId } from "./roles";

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

  let { data, error } = await supabase
    .from("users")
    .select(
      "id, email, role_id, first_name, last_name, birth_date, id_num, passport_num, cell_num, sanc_num, active",
    )
    .eq("id", authUser.id)
    .single();

  // Self-heal: If user exists in Auth but public.users row is missing (e.g. email confirmation delay),
  // recover profile from auth user_metadata
  if ((error || !data) && authUser.user_metadata) {
    const meta = authUser.user_metadata;
    const studentRoleId = await resolveStudentRoleId();
    const fallbackRoleId = (meta.role_id as string | undefined) || studentRoleId;

    if (fallbackRoleId) {
      const { data: inserted, error: insertError } = await supabase
        .from("users")
        .upsert({
          id: authUser.id,
          email: authUser.email ?? "",
          role_id: fallbackRoleId,
          first_name: (meta.first_name as string) ?? "",
          last_name: (meta.last_name as string) ?? "",
          birth_date: (meta.birth_date as string) ?? null,
          id_num: (meta.id_num as string) ?? null,
          passport_num: (meta.passport_num as string) ?? null,
          cell_num: (meta.cell_num as string) ?? null,
          sanc_num: (meta.sanc_num as string) ?? null,
          active: true,
        })
        .select()
        .single();

      if (!insertError && inserted) {
        data = inserted;
        error = null;
      }
    }
  }

  if (error || !data || !data.active) return null;
  return data as AppUser;
}

export function homeForRole(roleId: string, roleName?: string | null): string {
  return isAdminRole(roleId, roleName) ? "/dashboard" : "/studentlanding";
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export function displayName(user: Pick<AppUser, "first_name" | "last_name" | "email">): string {
  const combined = `${user.first_name} ${user.last_name}`.trim();
  return combined || user.email;
}

export function initials(user: Pick<AppUser, "first_name" | "last_name" | "email">): string {
  const first = user.first_name?.trim()?.[0];
  const last = user.last_name?.trim()?.[0];
  if (first && last) return `${first}${last}`.toUpperCase();
  if (first) return first.toUpperCase();
  return user.email.slice(0, 2).toUpperCase();
}
