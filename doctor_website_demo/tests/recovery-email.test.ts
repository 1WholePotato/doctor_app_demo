import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { authLinkOutcome, recoveryStep } from "../src/lib/auth";

type Captured = { url: URL; method: string; body: Record<string, unknown> };
type Route = (request: Captured) => Response | undefined;

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const STUDENT_ID = "b0100000-0000-4000-8000-000000000012";
const authUser = (email: string, new_email?: string) => ({
  id: STUDENT_ID, aud: "authenticated", role: "authenticated", email, new_email,
  app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-01-01T00:00:00Z",
});

async function signedInApp(route: Route) {
  const requests: Captured[] = [];
  const client = createClient("https://backend.example.test", "offline-anon-key", {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: async (input, init) => {
        const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
        const request = { url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : {} };
        requests.push(request);
        if (url.pathname === "/auth/v1/token") {
          return response({
            access_token: "access", refresh_token: "refresh", expires_in: 3600, token_type: "bearer",
            user: authUser("student@example.test"),
          });
        }
        const routed = route(request);
        if (routed) return routed;
        throw new Error(`Unexpected offline request ${request.method} ${url}`);
      },
    },
  });
  vi.doMock("../src/supabaseClient", () => ({ supabase: client }));
  const auth = await import("../src/lib/auth");
  await client.auth.signInWithPassword({ email: "student@example.test", password: "secret" });
  requests.length = 0;
  return { ...auth, requests };
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("window", { location: { origin: "https://app.example.test" } });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("auth link outcomes", () => {
  it.each([
    ["#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired", ""],
    ["", "?error=access_denied&error_description=Email+link+is+invalid"],
    ["#error_code=otp_expired", ""],
  ])("treats %s%s as a failed link", (hash, search) => {
    expect(authLinkOutcome({ hash, search })).toBe("failed");
  });

  it("recognises the first of two email-change confirmations", () => {
    const hash = "#message=Confirmation+link+accepted.+Please+proceed+to+confirm+link+sent+to+the+other+email&sb=";
    expect(authLinkOutcome({ hash, search: "" })).toBe("awaiting-other-link");
  });

  it.each([
    ["#access_token=abc&type=recovery", ""],
    ["", ""],
  ])("treats %s%s as a usable link", (hash, search) => {
    expect(authLinkOutcome({ hash, search })).toBe(null);
  });
});

describe("password recovery step", () => {
  const base = { resetMode: true, linkFailed: false, passwordRecovery: false, loading: false };

  it("asks for an email on the forgot-password page", () => {
    expect(recoveryStep({ ...base, resetMode: false })).toBe("request-link");
  });

  it("waits while the reset link is being exchanged for a session", () => {
    expect(recoveryStep({ ...base, loading: true })).toBe("checking-link");
  });

  it("lets a recovery session choose a new password", () => {
    expect(recoveryStep({ ...base, passwordRecovery: true })).toBe("choose-password");
  });

  it("offers a new link when the reset link failed, even with an older session", () => {
    expect(recoveryStep({ ...base, linkFailed: true, passwordRecovery: true })).toBe("request-link");
    expect(recoveryStep({ ...base, linkFailed: true, loading: true })).toBe("request-link");
  });

  it("offers a new link when the reset page opens without a recovery session", () => {
    expect(recoveryStep(base)).toBe("request-link");
  });
});

describe("email changes", () => {
  const userRoute = (user: ReturnType<typeof authUser>): Route => ({ url, method }) =>
    url.pathname === "/auth/v1/user" && method === "PUT" ? response(user) : undefined;

  it("reports a pending change while Auth keeps the confirmed email", async () => {
    const app = await signedInApp(userRoute(authUser("student@example.test", "next@example.test")));

    await expect(app.requestEmailChange("next@example.test")).resolves.toBe("pending");
    expect(app.requests).toHaveLength(1);
    expect(app.requests[0].body.email).toBe("next@example.test");
    expect(app.requests[0].url.searchParams.get("redirect_to")).toBe("https://app.example.test/profile");
  });

  it("reports a completed change when Auth applies it immediately", async () => {
    const app = await signedInApp(userRoute(authUser("next@example.test")));

    await expect(app.requestEmailChange("next@example.test")).resolves.toBe("changed");
  });

  it("surfaces a rejected change without writing the profile email", async () => {
    const app = await signedInApp(({ url }) => url.pathname === "/auth/v1/user"
      ? response({ code: 422, error_code: "email_exists", msg: "A user with this email address has already been registered" }, 422)
      : undefined);

    await expect(app.requestEmailChange("taken@example.test")).rejects.toMatchObject({ code: "email_exists" });
    expect(app.requests.map((r) => `${r.method} ${r.url.pathname}`)).toEqual(["PUT /auth/v1/user"]);
  });

  it("loads a drifted profile without writing the email from the browser", async () => {
    const app = await signedInApp(({ url }) => {
      if (url.pathname === "/auth/v1/user") return response(authUser("confirmed@example.test"));
      if (url.pathname === "/rest/v1/roles") return response([{ id: "student-role", name: "student" }]);
      if (url.pathname === "/rest/v1/users") {
        return response({
          id: STUDENT_ID, email: "stale@example.test", role_id: "student-role", first_name: "Fixture", last_name: "Student",
          birth_date: null, id_num: null, passport_num: "P1", cell_num: "0820000000", sanc_num: null, active: true,
        });
      }
      return undefined;
    });

    await expect(app.getSessionUser()).resolves.toMatchObject({ email: "stale@example.test" });
    expect(app.requests.every((r) => r.method === "GET")).toBe(true);
  });
});
