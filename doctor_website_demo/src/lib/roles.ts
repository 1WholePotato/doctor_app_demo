import { supabase } from "../supabaseClient";

export type RoleOption = {
  id: string;
  name: string;
};

export const STUDENT_ROLE_ID = import.meta.env.VITE_STUDENT_ROLE_ID ?? "";
export const ADMIN_ROLE_ID = import.meta.env.VITE_ADMIN_ROLE_ID ?? "";

let cachedRoles: RoleOption[] | null = null;

function envRole(id: string | undefined, name: string): RoleOption | null {
  if (!id?.trim()) return null;
  return { id: id.trim(), name };
}

function normalizeRoleName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("admin")) return "Admin";
  if (lower.includes("student")) return "Student";
  return name;
}

export async function loadRoles(): Promise<RoleOption[]> {
  if (cachedRoles?.length) return cachedRoles;

  const { data: rolesData, error: rolesError } = await supabase
    .from("roles")
    .select("id, name")
    .order("name");

  if (!rolesError && rolesData?.length) {
    cachedRoles = rolesData.map((row) => ({
      id: row.id,
      name: normalizeRoleName(row.name ?? "Role"),
    }));
    return cachedRoles;
  }

  const fromEnv = [
    envRole(STUDENT_ROLE_ID, "Student"),
    envRole(ADMIN_ROLE_ID, "Admin"),
  ].filter((role): role is RoleOption => role !== null);

  cachedRoles = fromEnv;
  return cachedRoles;
}

function findRoleIdByName(roles: RoleOption[], names: string[]): string | null {
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

export function roleLabel(roleId: string, roles: RoleOption[]): string {
  const match = roles.find((role) => role.id === roleId);
  return match?.name ?? "Unknown";
}

export function isAdminRole(
  roleId: string,
  roleNameOrRoles?: string | null | RoleOption[],
): boolean {
  if (Array.isArray(roleNameOrRoles)) {
    const match = roleNameOrRoles.find((role) => role.id === roleId);
    if (match) return match.name.toLowerCase().includes("admin");
  } else if (typeof roleNameOrRoles === "string") {
    if (/^admin$/i.test(roleNameOrRoles)) return true;
    if (/^student$/i.test(roleNameOrRoles)) return false;
  }

  if (ADMIN_ROLE_ID && roleId === ADMIN_ROLE_ID) return true;
  if (STUDENT_ROLE_ID && roleId === STUDENT_ROLE_ID) return false;

  if (cachedRoles) {
    const role = cachedRoles.find((r) => r.id === roleId);
    if (role) return role.name.toLowerCase().includes("admin");
  }

  return false;
}
