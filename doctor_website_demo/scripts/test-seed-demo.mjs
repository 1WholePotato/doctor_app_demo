import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { beforeEach, test } from "node:test";
import { seedDemo } from "./seed-demo.mjs";

const now = new Date("2026-10-17T23:30:00.000Z");
const env = {
  VITE_SUPABASE_URL: "https://seed-offline.invalid",
  SEED_CONFIRM_URL: "https://seed-offline.invalid",
  SUPABASE_SERVICE_ROLE_KEY: "offline-test-key",
};

beforeEach((context) => {
  context.mock.method(console, "log", () => {});
});

function fakeSupabase({ roles = [], failRole } = {}) {
  const tables = {
    roles: structuredClone(roles),
    users: [],
    instructors: [],
    locations: [],
    courses: [],
    course_sessions: [],
    bookings: [],
    payments: [],
    instructor_courses: [],
  };
  const authUsers = [];
  const requests = [];
  const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

  async function fetch(input, options = {}) {
    const url = new URL(input);
    assert.equal(url.origin, env.VITE_SUPABASE_URL);
    const method = options.method ?? "GET";
    const body = options.body ? JSON.parse(options.body) : undefined;
    const query = Object.fromEntries(url.searchParams);
    requests.push({ path: url.pathname, method, body, query });

    if (url.pathname.startsWith("/auth/v1/admin/users")) {
      if (method === "GET") return json({ users: authUsers });
      if (method === "POST") {
        const user = { id: randomUUID(), ...body };
        authUsers.push(user);
        return json(user);
      }
      assert.equal(method, "PUT");
      const user = authUsers.find((row) => row.id === url.pathname.split("/").at(-1));
      assert.ok(user);
      Object.assign(user, body);
      return json(user);
    }

    assert.ok(url.pathname.startsWith("/rest/v1/"));
    const table = url.pathname.split("/").at(-1);
    const rows = tables[table];
    assert.ok(rows, `Unexpected table ${table}`);
    const matches = rows.filter((row) => Object.entries(query).every(([key, value]) => {
      return !value.startsWith("eq.") || String(row[key]) === value.slice(3);
    }));
    let result = matches;
    if (method === "POST") {
      if (table === "roles" && body.name === failRole) {
        return json({ message: "Role creation denied", code: "42501" }, 403);
      }
      const row = { id: randomUUID(), ...body };
      rows.push(row);
      result = [row];
    } else if (method === "PATCH") {
      for (const row of matches) Object.assign(row, body);
    } else {
      assert.equal(method, "GET");
    }
    if (new Headers(options.headers).get("Accept") === "application/vnd.pgrst.object+json") {
      assert.equal(result.length, 1);
      return json(result[0]);
    }
    return json(result);
  }

  return { tables, authUsers, requests, fetch };
}

test("invalid configuration fails before any HTTP request", async () => {
  const invalidConfigs = [
    [{ VITE_SUPABASE_URL: "" }, /VITE_SUPABASE_URL/],
    [{ SEED_CONFIRM_URL: undefined }, /SEED_CONFIRM_URL/],
    [{ SEED_CONFIRM_URL: "https://another-project.invalid" }, /SEED_CONFIRM_URL/],
    [{ SEED_CONFIRM_URL: `${env.VITE_SUPABASE_URL}/` }, /SEED_CONFIRM_URL/],
    [{ SUPABASE_SERVICE_ROLE_KEY: "" }, /SUPABASE_SERVICE_ROLE_KEY/],
    ...["2026-10-14", "2026-10-17", "2026-02-30", "2027-02-29", "2027-13-01", "2027-1-01", "invalid", ""].map(
      (date) => [{ SEED_SESSION_DATE: date }, /SEED_SESSION_DATE/],
    ),
  ];
  const api = fakeSupabase();
  for (const [overrides, error] of invalidConfigs) {
    await assert.rejects(seedDemo({ env: { ...env, ...overrides }, now, fetch: api.fetch }), error);
  }
  assert.equal(api.requests.length, 0);
});

test("fresh seed resolves roles before accounts and writes the app's booking contract", async () => {
  const api = fakeSupabase();
  await seedDemo({ env, now, fetch: api.fetch });

  assert.deepEqual(api.tables.roles.map((row) => row.name), ["admin", "student", "instructor"]);
  const firstAuthWrite = api.requests.findIndex((r) => r.path.startsWith("/auth/") && r.method === "POST");
  const roleWrites = api.requests.filter((r, i) => i < firstAuthWrite && r.path === "/rest/v1/roles" && r.method === "POST");
  assert.deepEqual(roleWrites.map((r) => r.body.name), ["admin", "student", "instructor"]);
  assert.equal(api.authUsers.length, 3);
  for (const user of api.tables.users) {
    const role = api.tables.roles.find((row) => row.name === user.last_name.toLowerCase());
    assert.equal(user.role_id, role.id);
    assert.equal(api.authUsers.find((row) => row.id === user.id).email_confirm, true);
  }

  assert.equal(api.tables.courses.length, 3);
  assert.equal(api.tables.course_sessions.length, 3);
  for (const session of api.tables.course_sessions) {
    assert.equal(session.start_date, "2026-10-24");
    assert.equal(session.end_date, "2026-10-24");
    assert.equal(session.start_time, "09:00:00");
    assert.equal(session.end_time, "12:00:00");
  }
  assert.deepEqual(api.tables.bookings.map((row) => row.payment_status), ["paid", "passed", "failed"]);
  for (const [index, booking] of api.tables.bookings.entries()) {
    assert.equal(booking.course_session_id, api.tables.courses[index].id);
    assert.equal(booking.total_amount, api.tables.courses[index].course_price);
    assert.equal(booking.material_fee, 0);
    assert.equal("course_id" in booking, false);
  }
  const lookups = api.requests.filter((r) => r.path === "/rest/v1/bookings" && r.method === "GET");
  assert.deepEqual(lookups.map((r) => r.query.course_session_id), api.tables.courses.map((row) => `eq.${row.id}`));
  assert.ok(lookups.every((r) => !("course_id" in r.query)));
  assert.equal(api.tables.payments.length, 1);
  assert.equal(api.tables.payments[0].booking_id, api.tables.bookings[0].id);
  assert.equal(api.tables.instructor_courses.length, 5);
});

test("rerun reuses mixed-case roles and fixtures and moves historical sessions to the configured date", async () => {
  const api = fakeSupabase({ roles: ["Admin", "STUDENT", "Instructor"].map((name) => ({ id: randomUUID(), name })) });
  await seedDemo({ env, now, fetch: api.fetch });
  const counts = Object.fromEntries(Object.entries(api.tables).map(([table, rows]) => [table, rows.length]));
  for (const session of api.tables.course_sessions) {
    session.start_date = "2026-10-14";
    session.end_date = "2026-10-14";
  }
  api.tables.bookings[0].payment_status = "pending";
  api.requests.length = 0;
  await seedDemo({ env: { ...env, SEED_SESSION_DATE: "2028-02-29" }, now, fetch: api.fetch });

  assert.deepEqual(Object.fromEntries(Object.entries(api.tables).map(([table, rows]) => [table, rows.length])), counts);
  assert.equal(api.authUsers.length, 3);
  assert.ok(api.tables.course_sessions.every((row) => row.start_date === "2028-02-29" && row.end_date === "2028-02-29"));
  assert.equal(api.requests.filter((r) => r.path === "/rest/v1/course_sessions" && r.method === "PATCH").length, 3);
  assert.equal(api.requests.filter((r) => r.method === "POST").length, 0);
  assert.equal(api.tables.bookings[0].payment_status, "paid");
  for (const user of api.tables.users) {
    assert.equal(user.role_id, api.tables.roles.find((row) => row.name.toLowerCase() === user.last_name.toLowerCase()).id);
  }
});

test("role resolution failure stops before auth or profile writes", async () => {
  const api = fakeSupabase({ failRole: "instructor" });
  await assert.rejects(seedDemo({ env, now, fetch: api.fetch }), /Role insert failed/);
  assert.equal(api.authUsers.length, 0);
  assert.equal(api.tables.users.length, 0);
  assert.ok(api.requests.every((r) => r.path === "/rest/v1/roles"));
});
