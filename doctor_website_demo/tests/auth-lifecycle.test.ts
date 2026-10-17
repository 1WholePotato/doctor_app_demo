import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createAuthSignals, type AuthSignal } from "../src/lib/authSignals";
import { createAuthLifecycle, initialAuthState, type AuthState } from "../src/context/authLifecycle";
import type { AppUser } from "../src/lib/auth";

function profile(id = "alice"): AppUser {
  return {
    id, email: `${id}@example.test`, role_id: "student", first_name: id, last_name: "Test",
    birth_date: null, id_num: null, passport_num: null, cell_num: null, sanc_num: null, active: true,
  };
}

function authUser(id: string) {
  return {
    id, email: `${id}@example.test`, aud: "authenticated", role: "authenticated",
    app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-01-01T00:00:00Z",
  };
}

function tokens(id: string) {
  const payload = Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  return { access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.c2lnbmF0dXJl`, refresh_token: id };
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Retry-After": "0" } });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const cleanups: (() => void)[] = [];

beforeEach(() => { vi.resetModules(); });
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  vi.unstubAllGlobals();
});

async function setup({ hash, existingSession = false }: { hash?: string; existingSession?: boolean } = {}) {
  if (hash !== undefined) {
    vi.stubGlobal("window", { location: new URL(`https://app.example.test/reset#${hash}`) });
    vi.stubGlobal("document", { visibilityState: "visible" });
    vi.stubGlobal("BroadcastChannel", undefined);
  }
  const backend = {
    profile: async (id: string) => response(profile(id)),
    userStatus: 200,
  };
  const storage = new Map<string, string>();
  const storageKey = `auth-test-${crypto.randomUUID()}`;
  if (existingSession) {
    storage.set(storageKey, JSON.stringify({
      ...tokens("alice"), user: authUser("alice"), expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600, token_type: "bearer",
    }));
  }
  const client = createClient("https://backend.example.test", "offline-anon-key", {
    auth: {
      autoRefreshToken: false, persistSession: true, detectSessionInUrl: true, storageKey,
      storage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => { storage.set(key, value); },
        removeItem: (key) => { storage.delete(key); },
      },
    },
    global: {
      fetch: async (input, init) => {
        const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
        if (url.pathname === "/auth/v1/user") {
          if (backend.userStatus !== 200) return response({ message: "Session revoked" }, backend.userStatus);
          const token = new Headers(init?.headers).get("Authorization")?.split(" ")[1];
          if (!token) throw new Error("Missing token");
          const { sub } = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
          return response(authUser(sub));
        }
        if (url.pathname === "/auth/v1/token") {
          const { refresh_token: id } = JSON.parse(String(init?.body));
          return response({ ...tokens(id), user: authUser(id), token_type: "bearer", expires_in: 3600 });
        }
        if (url.pathname === "/auth/v1/logout") return new Response(null, { status: 204 });
        if (url.pathname === "/rest/v1/roles") return response([{ id: "student", name: "Student" }]);
        if (url.pathname === "/rest/v1/users") {
          if (init?.method === "POST") return response({ message: "Profile unavailable", code: "42501" }, 403);
          const id = url.searchParams.get("id")?.slice(3);
          if (!id) throw new Error("Missing profile subject");
          return backend.profile(id);
        }
        throw new Error(`Unexpected offline request ${url}`);
      },
    },
  });
  const signals = createAuthSignals(client.auth);
  cleanups.push(() => { signals.dispose(); client.auth.stopAutoRefresh(); });
  vi.doMock("../src/supabaseClient", () => ({ supabase: client }));
  const { getSessionUser } = await import("../src/lib/auth");
  await client.auth.initialize();
  let state: AuthState = initialAuthState;
  const states: AuthState[] = [];
  function mount() {
    const lifecycle = createAuthLifecycle({ observe: signals.observe, loadUser: getSessionUser, publish(next) {
      state = next;
      states.push(next);
    } });
    cleanups.push(lifecycle.dispose);
    return lifecycle;
  }
  async function signIn(id = "alice") {
    const result = await client.auth.setSession(tokens(id));
    expect(result.error).toBeNull();
  }
  return { client, signals, backend, mount, signIn, states, get state() { return state; } };
}

const waitOptions = { timeout: 1500, interval: 5 };

describe("real SDK auth notifications and profile hydration", () => {
  it("settles setSession, updateUser and refreshSession without replacing an unchanged profile", async () => {
    const app = await setup();
    const lifecycle = app.mount();
    await app.signIn();
    await vi.waitFor(() => expect(app.state.user?.id).toBe("alice"), waitOptions);
    const verified = app.state.user;
    app.states.length = 0;
    expect((await app.client.auth.updateUser({ data: { first_name: "alice" } })).error).toBeNull();
    await lifecycle.refreshUser();
    expect((await app.client.auth.refreshSession()).error).toBeNull();
    await lifecycle.refreshUser();
    expect((await app.client.auth.getSession()).data.session?.user.id).toBe("alice");
    expect(app.state.user).toBe(verified);
    expect(app.states.every((state) => !state.loading && state.user === verified)).toBe(true);
    expect(app.state.passwordRecovery).toBe(false);
  }, 3000);

  it("hydrates changed profiles after SDK events without an explicit refresh", async () => {
    const app = await setup();
    app.mount();
    await app.signIn();
    await vi.waitFor(() => expect(app.state.user?.first_name).toBe("alice"), waitOptions);
    app.backend.profile = async () => response({ ...profile(), first_name: "Updated" });
    expect((await app.client.auth.updateUser({ data: { first_name: "Updated" } })).error).toBeNull();
    await vi.waitFor(() => expect(app.state.user?.first_name).toBe("Updated"), waitOptions);
    app.backend.profile = async () => response({ ...profile(), first_name: "Refreshed" });
    expect((await app.client.auth.refreshSession()).error).toBeNull();
    await vi.waitFor(() => expect(app.state.user?.first_name).toBe("Refreshed"), waitOptions);
    expect((await app.client.auth.getSession()).error).toBeNull();
  }, 3000);

  it.each(["unchanged", "saved"])("finishes an explicit %s profile refresh across same-user token notifications", async (change) => {
    const app = await setup();
    const lifecycle = app.mount();
    await app.signIn();
    await vi.waitFor(() => expect(app.state.user?.id).toBe("alice"), waitOptions);
    const verified = app.state.user;
    const pending = deferred<Response>();
    const started = deferred<void>();
    app.backend.profile = async () => { started.resolve(); return (await pending.promise).clone(); };
    app.states.length = 0;
    const refresh = lifecycle.refreshUser();
    let settled = false;
    void refresh.then(() => { settled = true; }, () => { settled = true; });
    await started.promise;
    expect((await app.client.auth.refreshSession()).error).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(settled).toBe(false);
    expect(app.states.every((state) => !state.loading && state.user === verified)).toBe(true);
    const persisted = change === "saved" ? { ...profile(), first_name: "Saved" } : profile();
    pending.resolve(response(persisted));
    await expect(refresh).resolves.toBeUndefined();
    expect(app.state.user).toEqual(persisted);
    if (change === "unchanged") expect(app.state.user).toBe(verified);
    expect(app.state.loading).toBe(false);
    expect(app.state.authError).toBeNull();
  });

  it.each(["inactive", "wrong-account", "unavailable"])("still rejects %s verification across same-user token notifications", async (failure) => {
    const app = await setup();
    const lifecycle = app.mount();
    await app.signIn();
    await vi.waitFor(() => expect(app.state.user?.id).toBe("alice"), waitOptions);
    const verified = app.state.user;
    const pending = deferred<Response>();
    const started = deferred<void>();
    app.backend.profile = async () => { started.resolve(); return (await pending.promise).clone(); };
    const refresh = lifecycle.refreshUser();
    const rejected = expect(refresh).rejects.toMatchObject({
      message: failure === "unavailable" ? "Unavailable" : "Your account profile could not be verified.",
    });
    await started.promise;
    expect((await app.client.auth.refreshSession()).error).toBeNull();
    pending.resolve(failure === "unavailable" ? response({ message: "Unavailable" }, 503)
      : response(failure === "inactive" ? { ...profile(), active: false } : profile("bob")));
    await rejected;
    expect(app.state.user).toBe(failure === "unavailable" ? verified : null);
    expect(app.state.loading).toBe(false);
    expect(app.state.authError).toBeTruthy();
  });

  it("reads the saved profile instead of joining a pending background snapshot", async () => {
    const app = await setup();
    const lifecycle = app.mount();
    await app.signIn();
    await vi.waitFor(() => expect(app.state.user?.id).toBe("alice"), waitOptions);
    const pending = deferred<Response>();
    const started = deferred<void>();
    app.backend.profile = async () => { started.resolve(); return (await pending.promise).clone(); };
    expect((await app.client.auth.refreshSession()).error).toBeNull();
    await started.promise;
    app.backend.profile = async () => response({ ...profile(), first_name: "Saved" });
    await lifecycle.refreshUser();
    expect(app.state.user?.first_name).toBe("Saved");
    const saved = app.state;
    pending.resolve(response({ ...profile(), first_name: "Before save" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(app.state).toBe(saved);
  });

  it.each(["success", "error"])("ignores late %s after logout", async (result) => {
    const app = await setup();
    const lifecycle = app.mount();
    await app.signIn();
    await vi.waitFor(() => expect(app.state.user?.id).toBe("alice"), waitOptions);
    const pending = deferred<Response>();
    const started = deferred<void>();
    app.backend.profile = () => { started.resolve(); return pending.promise; };
    const refresh = lifecycle.refreshUser();
    const rejected = expect(refresh).rejects.toBeDefined();
    await started.promise;
    expect((await app.client.auth.signOut()).error).toBeNull();
    const signedOut = app.state;
    expect(signedOut).toEqual({ user: null, loading: false, authError: null, passwordRecovery: false });
    pending.resolve(result === "success" ? response(profile()) : response({ message: "Verification failed" }, 400));
    await rejected;
    expect(app.state).toBe(signedOut);
  });

  it("invalidates an old A response across A to B to A", async () => {
    const app = await setup();
    const lifecycle = app.mount();
    await app.signIn();
    await vi.waitFor(() => expect(app.state.user?.id).toBe("alice"), waitOptions);
    const pending = deferred<Response>();
    const started = deferred<void>();
    app.backend.profile = () => { started.resolve(); return pending.promise; };
    const refresh = lifecycle.refreshUser();
    const rejected = expect(refresh).rejects.toBeDefined();
    await started.promise;
    app.backend.profile = async (id) => response({ ...profile(id), first_name: "Current" });
    await app.signIn("bob");
    expect(app.state.user).toBeNull();
    expect(app.state.loading).toBe(true);
    await vi.waitFor(() => expect(app.state.user?.id).toBe("bob"), waitOptions);
    await app.signIn();
    expect(app.state.user).toBeNull();
    await vi.waitFor(() => expect(app.state.user?.first_name).toBe("Current"), waitOptions);
    const current = app.state;
    pending.resolve(response({ ...profile(), first_name: "Obsolete" }));
    await rejected;
    expect(app.state).toBe(current);
  });

  it("keeps the newest explicit refresh when responses finish out of order", async () => {
    const app = await setup();
    const lifecycle = app.mount();
    await app.signIn();
    await vi.waitFor(() => expect(app.state.user?.id).toBe("alice"), waitOptions);
    const pending = deferred<Response>();
    const started = deferred<void>();
    app.backend.profile = () => { started.resolve(); return pending.promise; };
    const older = lifecycle.refreshUser();
    const rejected = expect(older).rejects.toBeDefined();
    await started.promise;
    app.backend.profile = async () => response({ ...profile(), first_name: "Newest" });
    await lifecycle.refreshUser();
    const newest = app.state;
    pending.resolve(response(profile()));
    await rejected;
    expect(app.state).toBe(newest);
    expect(app.state.user?.first_name).toBe("Newest");
  });

  it.each(["success", "error"])("disposal and replacement cannot revive the previous lifecycle's %s", async (result) => {
    const app = await setup();
    const first = app.mount();
    await app.signIn();
    await vi.waitFor(() => expect(app.state.user?.id).toBe("alice"), waitOptions);
    const pending = deferred<Response>();
    const started = deferred<void>();
    app.backend.profile = () => { started.resolve(); return pending.promise; };
    const refresh = first.refreshUser();
    const rejected = expect(refresh).rejects.toBeDefined();
    await started.promise;
    first.dispose();
    app.backend.profile = async () => response({ ...profile(), first_name: "Remounted" });
    app.mount();
    await vi.waitFor(() => expect(app.state.user?.first_name).toBe("Remounted"), waitOptions);
    const remounted = app.state;
    pending.resolve(result === "success" ? response(profile()) : response({ message: "Verification failed" }, 400));
    await rejected;
    expect(app.state).toBe(remounted);
  });

  it("rejects transient refresh failures while retaining the verified profile", async () => {
    const app = await setup();
    const lifecycle = app.mount();
    await app.signIn();
    await vi.waitFor(() => expect(app.state.user?.id).toBe("alice"), waitOptions);
    const verified = app.state.user;
    app.backend.profile = async () => response({ message: "Unavailable" }, 503);
    await expect(lifecycle.refreshUser()).rejects.toBeDefined();
    expect(app.state.user).toBe(verified);
    expect(app.state.loading).toBe(false);
    expect(app.state.authError).toBeTruthy();
  });

  it("blocks initial verification failures and recovers on retry", async () => {
    const app = await setup();
    app.backend.profile = async () => response({ message: "Unavailable" }, 503);
    const lifecycle = app.mount();
    await app.signIn();
    await vi.waitFor(() => expect(app.state.authError).toBeTruthy(), waitOptions);
    expect(app.state.user).toBeNull();
    expect(app.state.loading).toBe(false);
    app.backend.profile = async () => response(profile());
    await lifecycle.refreshUser();
    expect(app.state.user?.id).toBe("alice");
    expect(app.state.authError).toBeNull();
  });

  it.each(["inactive", "missing", "revoked", "invalid-token"])("clears a previously verified %s account", async (failure) => {
    const app = await setup();
    const lifecycle = app.mount();
    await app.signIn();
    await vi.waitFor(() => expect(app.state.user?.id).toBe("alice"), waitOptions);
    if (failure === "inactive") app.backend.profile = async () => response({ ...profile(), active: false });
    if (failure === "missing") app.backend.profile = async () => response({ code: "PGRST116", message: "No rows" }, 406);
    if (failure === "revoked") app.backend.userStatus = 401;
    if (failure === "invalid-token") app.backend.userStatus = 400;
    await expect(lifecycle.refreshUser()).rejects.toBeDefined();
    expect(app.state.user).toBeNull();
    expect(app.state.loading).toBe(false);
    expect(app.state.authError).toBeTruthy();
  });
});

function recoveryHash() {
  return new URLSearchParams({ ...tokens("alice"), expires_in: "3600", token_type: "bearer", type: "recovery" }).toString();
}

describe("SDK-confirmed recovery retained before provider subscription", () => {
  it("replays recovery after the SDK clears the URL, through password update and refresh, until logout", async () => {
    const app = await setup({ hash: recoveryHash() });
    let signal: AuthSignal = { kind: "initializing" };
    const unsubscribe = app.signals.observe((next) => { signal = next; });
    await vi.waitFor(() => expect(signal).toMatchObject({ passwordRecovery: true }), waitOptions);
    unsubscribe();
    expect(window.location.hash).toBe("");
    app.mount();
    expect(app.state.passwordRecovery).toBe(true);
    expect((await app.client.auth.updateUser({ password: "offline-new-password" })).error).toBeNull();
    expect(app.state.passwordRecovery).toBe(true);
    expect((await app.client.auth.refreshSession()).error).toBeNull();
    expect(app.state.passwordRecovery).toBe(true);
    expect((await app.client.auth.signOut()).error).toBeNull();
    expect(app.state.passwordRecovery).toBe(false);
    expect(app.state.user).toBeNull();
  }, 3000);

  it("clears recovery on an account switch", async () => {
    const app = await setup({ hash: recoveryHash() });
    app.mount();
    await vi.waitFor(() => expect(app.state.passwordRecovery).toBe(true), waitOptions);
    await app.signIn("bob");
    expect(app.state.passwordRecovery).toBe(false);
  });

  it.each(["", "type=recovery", "error=access_denied&error_code=otp_expired&error_description=Expired"])(
    "does not authorize recovery for an existing session with unconfirmed URL %s", async (hash) => {
      const app = await setup({ hash, existingSession: true });
      const lifecycle = app.mount();
      await lifecycle.refreshUser();
      expect(app.state.user?.id).toBe("alice");
      expect(app.state.passwordRecovery).toBe(false);
    },
  );
});
