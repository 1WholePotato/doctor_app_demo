import { supabase } from "../supabaseClient";
import { isAdminRole, loadRoles } from "./roles";

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
  if (message.includes("database error saving new user")) {
    return "We couldn't create your student profile. Check your details and try again.";
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

export type Registration = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  cell_num: string;
  sanc_num: string;
  identity: { kind: "id"; id_num: string } | { kind: "passport"; passport_num: string };
};

export async function registerStudent({ email, password, identity, ...profile }: Registration): Promise<"signed_in" | "confirm_email"> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        first_name: profile.first_name.trim(),
        last_name: profile.last_name.trim(),
        birth_date: profile.birth_date,
        cell_num: profile.cell_num.trim(),
        sanc_num: profile.sanc_num.trim() || null,
        id_num: identity.kind === "id" ? identity.id_num.trim() : null,
        passport_num: identity.kind === "passport" ? identity.passport_num.trim() : null,
      },
    },
  });
  if (error) throw error;
  return data.session ? "signed_in" : "confirm_email";
}

export async function getSessionUser(): Promise<AppUser | null> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
  if (sessionError) {
    if (sessionError.name === "AuthSessionMissingError"
      || (sessionError.status && sessionError.status >= 400 && sessionError.status < 500
        && sessionError.status !== 408 && sessionError.status !== 429)) return null;
    throw sessionError;
  }
  const authUser = sessionData.user;
  if (!authUser) return null;

  await loadRoles();

  const profile = await supabase
    .from("users")
    .select(
      "id, email, role_id, first_name, last_name, birth_date, id_num, passport_num, cell_num, sanc_num, active",
    )
    .eq("id", authUser.id)
    .single();
  const { data, error } = profile;
  if (profile.status === 401 || profile.status === 403) return null;
  if (error && error.code !== "PGRST116") throw error;

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
