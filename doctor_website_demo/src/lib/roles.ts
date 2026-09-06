import { supabase } from "../supabaseClient";

export type RoleOption = {
  id: string;
  name: string;
};

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
    cachedRoles = rolesData.map((r) => ({
      id: r.id,
      name: normalizeRoleName(r.name ?? "Role"),
    }));
    return cachedRoles;
  }

  const { data: usersData, error: usersError } = await supabase
    .from("users")
    .select("role_id");

  if (!usersError && usersData?.length) {
    const distinct = [...new Set(usersData.map((u) => u.role_id).filter(Boolean))];
    if (distinct.length) {
      cachedRoles = distinct.map((id) => ({
        id,
        name: id.includes("admin") || id.includes("Admin") ? "Admin" : "Student",
      }));
      return cachedRoles;
    }
  }

  const fromEnv = [
    envRole(import.meta.env.VITE_STUDENT_ROLE_ID, "Student"),
    envRole(import.meta.env.VITE_ADMIN_ROLE_ID, "Admin"),
  ].filter((r): r is RoleOption => r !== null);

  cachedRoles = fromEnv;
  return cachedRoles;
}

export function roleLabel(roleId: string, roles: RoleOption[]): string {
  const match = roles.find((r) => r.id === roleId);
  return match?.name ?? "Unknown";
}

export function isAdminRole(roleId: string, roles: RoleOption[]): boolean {
  const match = roles.find((r) => r.id === roleId);
  if (match) return match.name.toLowerCase().includes("admin");
  return roleId === import.meta.env.VITE_ADMIN_ROLE_ID;
}
