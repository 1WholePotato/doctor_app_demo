import { supabase } from "../supabaseClient";
import { isAdminRole, loadRoles, resolveStudentRoleId } from "./roles";

export function authErrorMessage(error: { message?: string; code?: string }): string {
  const message = error.message?.toLowerCase() ?? "";
  if (error.code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return "Email or password is incorrect.";
  }
  if (message.includes("email not confirmed")) return "Confirm your email using the link we sent before signing in.";
  if (message.includes("invalid email") || message.includes("email address is invalid")) {
    return "Enter a valid email address and try again.";
  }
  if (message.includes("user already registered") || message.includes("already been registered")) {
    return "An account with this email already exists. Sign in or reset your password.";
  }
  if (message.includes("password should be at least") || message.includes("weak_password")) {
    return "Choose a stronger password that meets the password requirements.";
  }
  if (message.includes("rate limit") || message.includes("too many requests")) {
    return "Too many attempts. Wait a few minutes and try again.";
  }
  if (message.includes("otp_expired") || message.includes("token has expired") || message.includes("invalid token")) {
    return "This link has expired or was already used. Request a new one and try again.";
  }
  if (message.includes("network") || message.includes("fetch")) {
    return "We couldn't reach the account service. Check your connection and try again.";
  }
  return error.message || "The account request failed. Please try again.";
}

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

  // Repair missing profiles with the configured student role; editable metadata is never authoritative.
  if (!data && (!error || error.code === "PGRST116") && authUser.user_metadata) {
    const meta = authUser.user_metadata;
    const studentRoleId = await resolveStudentRoleId();

    if (studentRoleId) {
      const { data: inserted, error: insertError } = await supabase
        .from("users")
        .upsert({
          id: authUser.id,
          email: authUser.email ?? "",
          role_id: studentRoleId,
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

  // Auth is canonical. In particular, an email change becomes active only after confirmation.
  if (authUser.email && data.email !== authUser.email) {
    const { error: syncError } = await supabase
      .from("users")
      .update({ email: authUser.email })
      .eq("id", authUser.id);
    if (!syncError) data.email = authUser.email;
  }
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
