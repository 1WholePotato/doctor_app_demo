import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";

const { API_URL, ANON_KEY, SERVICE_ROLE_KEY, EXPECT_EMAIL_CONFIRMATION } = process.env;
const MAIL_URL = process.env.MAILPIT_URL ?? process.env.INBUCKET_URL;
if (!API_URL || !ANON_KEY || !SERVICE_ROLE_KEY || !MAIL_URL || !["true", "false"].includes(EXPECT_EMAIL_CONFIRMATION)) {
  throw new Error("Set API_URL, ANON_KEY, SERVICE_ROLE_KEY, MAILPIT_URL and EXPECT_EMAIL_CONFIRMATION=true|false from `supabase status -o env`.");
}
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(API_URL)) throw new Error(`Refusing to register test accounts on ${API_URL}`);

const confirmationEnabled = EXPECT_EMAIL_CONFIRMATION === "true";
const STUDENT_ROLE_ID = "4fd9e72e-f94b-4222-b5c1-95b447088d4d";
const ADMIN_ROLE_ID = "ef387d99-bdbd-4304-b6ab-946b58475aa1";
const PASSWORD = "Registration-Test-1";
const CONFIRMATION_EMAIL_THROTTLE_MS = 1100;

const client = () => createClient(API_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const service = createClient(API_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

function details(first_name = "Reggie") {
  return {
    first_name, last_name: "Strant", birth_date: "1998-08-08", cell_num: "0821112222",
    sanc_num: null, id_num: null, passport_num: "E2E-PASSPORT",
  };
}

const freshEmail = (label) => `${label}-${randomUUID()}@example.test`;

function signUp(email, data = details()) {
  return client().auth.signUp({ email, password: PASSWORD, options: { data } });
}

async function accountsFor(email) {
  const { data, error } = await service.auth.admin.listUsers({ perPage: 1000 });
  assert.ifError(error);
  return data.users.filter((user) => user.email === email);
}

async function profilesFor(email) {
  const { data, error } = await service.from("users").select("*").eq("email", email);
  assert.ifError(error);
  return data;
}

async function confirmFromMailbox(email) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const search = await fetch(`${MAIL_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`).then((r) => r.json());
    const id = search.messages?.[0]?.ID;
    if (id) {
      const message = await fetch(`${MAIL_URL}/api/v1/message/${id}`).then((r) => r.json());
      const link = message.Text.match(/https?:\/\/\S+\/auth\/v1\/verify\?\S+/)?.[0];
      assert.ok(link, "confirmation email carries a verify link");
      const verified = await fetch(link, { redirect: "manual" });
      assert.equal(verified.status, 303, "verify link redirects after confirming");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.fail(`no confirmation email reached ${email}`);
}

async function signedInStudent(email) {
  const student = client();
  const { error } = await student.auth.signInWithPassword({ email, password: PASSWORD });
  assert.ifError(error);
  return student;
}

test(`registration with email confirmation ${confirmationEnabled ? "enabled" : "disabled"} yields a usable student profile`, async () => {
  const email = freshEmail("register");
  const { data, error } = await signUp(email);
  assert.ifError(error);
  assert.equal(Boolean(data.session), !confirmationEnabled, "session presence matches the confirmation mode");

  const [profile] = await profilesFor(email);
  assert.equal(profile?.id, data.user.id, "profile exists as soon as Auth creates the account");
  assert.equal(profile.role_id, STUDENT_ROLE_ID);

  if (confirmationEnabled) await confirmFromMailbox(email);
  const student = await signedInStudent(email);
  const own = await student.from("users").select("id, role_id, first_name, passport_num, sanc_num, active").eq("id", data.user.id).single();
  assert.ifError(own.error);
  assert.deepEqual(own.data, {
    id: data.user.id, role_id: STUDENT_ROLE_ID, first_name: "Reggie", passport_num: "E2E-PASSPORT", sanc_num: null, active: true,
  });
});

test("re-submitting the same registration leaves one account and one unchanged profile", async () => {
  const email = freshEmail("resubmit");
  assert.ifError((await signUp(email)).error);
  if (confirmationEnabled) await new Promise((resolve) => setTimeout(resolve, CONFIRMATION_EMAIL_THROTTLE_MS));
  const retry = await signUp(email, details("Changed"));
  if (confirmationEnabled) assert.ifError(retry.error);
  else assert.equal(retry.error?.code, "user_already_exists");

  assert.equal((await accountsFor(email)).length, 1);
  const profiles = await profilesFor(email);
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].first_name, "Reggie");
});

test("concurrent submissions of one registration leave one account and one profile", async () => {
  const email = freshEmail("race");
  const results = await Promise.all(Array.from({ length: 6 }, () => signUp(email)));
  assert.ok(results.some((result) => !result.error), "at least one submission succeeds");
  assert.equal((await accountsFor(email)).length, 1);
  assert.equal((await profilesFor(email)).length, 1);
});

test("a registration that asks for a role is rejected and leaves no account", async () => {
  const email = freshEmail("escalate");
  const { error } = await signUp(email, { ...details(), role: "admin" });
  assert.equal(error?.status, 500);
  assert.equal(error?.message, "Database error saving new user");
  assert.equal((await accountsFor(email)).length, 0);
  assert.equal((await profilesFor(email)).length, 0);
});

test("clients cannot write a profile with a chosen role", async () => {
  const anonInsert = await client().from("users").insert({
    id: randomUUID(), role_id: ADMIN_ROLE_ID, first_name: "Eve", last_name: "Admin", birth_date: "1990-01-01",
    passport_num: "P1", cell_num: "0820000000", email: freshEmail("anon-insert"),
  });
  assert.equal(anonInsert.error?.code, "42501");

  const email = freshEmail("self-upsert");
  assert.ifError((await signUp(email)).error);
  if (confirmationEnabled) await confirmFromMailbox(email);
  const student = await signedInStudent(email);
  const { data: { user } } = await student.auth.getUser();
  const upsert = await student.from("users").upsert({
    id: user.id, role_id: ADMIN_ROLE_ID, first_name: "Eve", last_name: "Admin", birth_date: "1990-01-01",
    passport_num: "P1", cell_num: "0820000000", email,
  });
  assert.equal(upsert.error?.code, "42501");
  assert.equal((await profilesFor(email))[0].role_id, STUDENT_ROLE_ID);
});
