import { supabase } from "../supabaseClient";

export const STUDENT_ROLE_ID = import.meta.env.VITE_STUDENT_ROLE_ID ?? "";
export const ADMIN_ROLE_ID = import.meta.env.VITE_ADMIN_ROLE_ID ?? "";

type RoleRow = { id: string; name: string };

let cachedRoles: RoleRow[] | null = null;

export async function loadRoles(): Promise<RoleRow[]> {
  if (cachedRoles) return cachedRoles;

  const { data, error } = await supabase.from("roles").select("id, name");
  if (error || !data) {
    cachedRoles = [];
    return cachedRoles;
  }

  cachedRoles = data as RoleRow[];
  return cachedRoles;
}

function findRoleIdByName(roles: RoleRow[], names: string[]): string | null {
  const normalized = names.map((n) => n.toLowerCase());
  const match = roles.find((role) => normalized.includes(role.name.toLowerCase()));
  return match?.id ?? null;
}

export async function resolveStudentRoleId(): Promise<string | null> {
  if (STUDENT_ROLE_ID) return STUDENT_ROLE_ID;

  const roles = await loadRoles();
  return findRoleIdByName(roles, ["student", "Student"]);
}

export async function resolveAdminRoleId(): Promise<string | null> {
  if (ADMIN_ROLE_ID) return ADMIN_ROLE_ID;

  const roles = await loadRoles();
  return findRoleIdByName(roles, ["admin", "Admin"]);
}

export function isAdminRole(roleId: string, roleName?: string | null): boolean {
  if (roleName && /^admin$/i.test(roleName)) return true;
  if (roleName && /^student$/i.test(roleName)) return false;
  if (ADMIN_ROLE_ID && roleId === ADMIN_ROLE_ID) return true;
  if (STUDENT_ROLE_ID && roleId === STUDENT_ROLE_ID) return false;

  if (cachedRoles) {
    const role = cachedRoles.find((r) => r.id === roleId);
    if (role) return /^admin$/i.test(role.name);
  }

  return false;
}
