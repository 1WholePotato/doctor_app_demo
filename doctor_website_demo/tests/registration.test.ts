import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Registration } from "../src/lib/auth";

type Captured = { path: string; method: string; body: Record<string, unknown> };

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const newUser = {
  id: "new-student", aud: "authenticated", role: "authenticated", email: "jane@example.test",
  app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-01-01T00:00:00Z",
};

async function setup(signupResponse: () => Response) {
  const requests: Captured[] = [];
  const client = createClient("https://backend.example.test", "offline-anon-key", {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: async (input, init) => {
        const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
        requests.push({ path: url.pathname, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : {} });
        if (url.pathname === "/auth/v1/signup") return signupResponse();
        throw new Error(`Unexpected offline request ${url}`);
      },
    },
  });
  vi.doMock("../src/supabaseClient", () => ({ supabase: client }));
  const { registerStudent } = await import("../src/lib/auth");
  return { registerStudent, requests };
}

const form: Registration = {
  email: " jane@example.test ", password: "Secret-123", first_name: " Jane ", last_name: " Smith ",
  birth_date: "1990-04-05", cell_num: " 0820000000 ", sanc_num: " ",
  identity: { kind: "passport", passport_num: " A1234567 " },
};

beforeEach(() => { vi.resetModules(); });

describe("student registration", () => {
  it("sends trimmed sign-up details with exactly one identity document and no role", async () => {
    const app = await setup(() => response({ user: newUser, session: null }));

    await app.registerStudent(form);

    expect(app.requests).toHaveLength(1);
    expect(app.requests[0].path).toBe("/auth/v1/signup");
    expect(app.requests[0].body.email).toBe("jane@example.test");
    expect(app.requests[0].body.data).toEqual({
      first_name: "Jane", last_name: "Smith", birth_date: "1990-04-05", cell_num: "0820000000",
      sanc_num: null, id_num: null, passport_num: "A1234567",
    });
  });

  it("reports that email confirmation is pending when Auth returns no session", async () => {
    const app = await setup(() => response({ user: newUser, session: null }));

    await expect(app.registerStudent(form)).resolves.toBe("confirm_email");
  });

  it("reports a signed-in student when Auth starts the session immediately", async () => {
    const app = await setup(() => response({
      access_token: "access", refresh_token: "refresh", expires_in: 3600, token_type: "bearer", user: newUser,
    }));

    await expect(app.registerStudent({ ...form, identity: { kind: "id", id_num: "9001010000000" } }))
      .resolves.toBe("signed_in");
    expect(app.requests[0].body.data).toMatchObject({ id_num: "9001010000000", passport_num: null });
  });

  it("surfaces a rejected sign-up instead of writing a profile itself", async () => {
    const app = await setup(() => response({ code: "unexpected_failure", message: "Database error saving new user" }, 500));

    await expect(app.registerStudent(form)).rejects.toMatchObject({ message: "Database error saving new user" });
    expect(app.requests.map((r) => r.path)).toEqual(["/auth/v1/signup"]);
  });
});
