import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";

const { API_URL, ANON_KEY, SERVICE_ROLE_KEY, DB_URL } = process.env;
const MAIL_URL = process.env.MAILPIT_URL ?? process.env.INBUCKET_URL;
if (!API_URL || !ANON_KEY || !SERVICE_ROLE_KEY || !DB_URL || !MAIL_URL) {
  throw new Error("Set API_URL, ANON_KEY, SERVICE_ROLE_KEY, DB_URL and MAILPIT_URL from `supabase status -o env`.");
}
for (const url of [API_URL, DB_URL]) {
  if (!/^[a-z]+:\/\/([^@/]+@)?(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(url)) throw new Error(`Refusing to test against ${url}`);
}

const PASSWORD = "Recovery-Test-1";
const NEW_PASSWORD = "Recovery-Test-2";
const EMAIL_THROTTLE_MS = 1100;
const REDIRECT = "http://localhost:5173/reset";

const client = () => createClient(API_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const service = createClient(API_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const freshEmail = (label) => `${label}-${randomUUID()}@example.test`;
const pause = () => new Promise((resolve) => setTimeout(resolve, EMAIL_THROTTLE_MS));

async function newStudent(label) {
  const email = freshEmail(label);
  const { data, error } = await service.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: {
      first_name: "Rhea", last_name: "Covery", birth_date: "1997-07-07", cell_num: "0823334444", passport_num: "E2E-RECOVERY",
    },
  });
  assert.ifError(error);
  return { id: data.user.id, email };
}

async function emails(id) {
  const [{ data: auth, error: authError }, { data: profile, error: profileError }] = await Promise.all([
    service.auth.admin.getUserById(id),
    service.from("users").select("email").eq("id", id).single(),
  ]);
  assert.ifError(authError);
  assert.ifError(profileError);
  return { auth: auth.user.email, pending: auth.user.new_email ?? null, profile: profile.email };
}

async function latestLink(email, seen = new Set()) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const search = await fetch(`${MAIL_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`).then((r) => r.json());
    const id = search.messages?.find((message) => !seen.has(message.ID))?.ID;
    if (id) {
      seen.add(id);
      const message = await fetch(`${MAIL_URL}/api/v1/message/${id}`).then((r) => r.json());
      const link = message.Text.match(/https?:\/\/\S+\/auth\/v1\/verify\?[^\s)]+/)?.[0];
      assert.ok(link, `email to ${email} carries a verify link`);
      return link;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.fail(`no email reached ${email}`);
}

async function follow(link) {
  const response = await fetch(link, { redirect: "manual" });
  assert.equal(response.status, 303, "verify links redirect back to the app");
  const location = new URL(response.headers.get("location"));
  return { location, params: new URLSearchParams(location.hash.slice(1)) };
}

async function requestRecovery(email) {
  const { error } = await client().auth.resetPasswordForEmail(email, { redirectTo: REDIRECT });
  assert.ifError(error);
}

async function signsIn(email, password) {
  const { error } = await client().auth.signInWithPassword({ email, password });
  return !error;
}

function assertLinkRejected(params) {
  assert.equal(params.get("error_code"), "otp_expired");
  assert.equal(params.has("access_token"), false, "a rejected link starts no session");
}

test("a valid recovery link lets the student set a new password, and only once", async () => {
  const student = await newStudent("recover");
  await requestRecovery(student.email);
  const link = await latestLink(student.email);

  const { location, params } = await follow(link);
  assert.equal(location.pathname, "/reset");
  assert.equal(params.get("type"), "recovery");
  const recovering = client();
  assert.ifError((await recovering.auth.setSession({
    access_token: params.get("access_token"), refresh_token: params.get("refresh_token"),
  })).error);
  assert.ifError((await recovering.auth.updateUser({ password: NEW_PASSWORD })).error);

  assert.equal(await signsIn(student.email, NEW_PASSWORD), true, "the new password signs in");
  assert.equal(await signsIn(student.email, PASSWORD), false, "the old password no longer signs in");

  assertLinkRejected((await follow(link)).params);
});

test("a tampered recovery link is rejected", async () => {
  const student = await newStudent("tamper");
  await requestRecovery(student.email);
  const link = new URL(await latestLink(student.email));
  const token = link.searchParams.get("token");
  link.searchParams.set("token", `${token.slice(0, -4)}${token.slice(-4) === "0000" ? "1111" : "0000"}`);

  assertLinkRejected((await follow(link.href)).params);
  assert.equal(await signsIn(student.email, PASSWORD), true, "the password is unchanged");
});

test("an expired recovery link is rejected and a new one works", async () => {
  const student = await newStudent("expire");
  await requestRecovery(student.email);
  const seen = new Set();
  const expired = await latestLink(student.email, seen);
  execFileSync("psql", [DB_URL, "-XAtqv", "ON_ERROR_STOP=1", "-c",
    `update auth.users set recovery_sent_at = now() - interval '1 day' where id = '${student.id}'`]);

  assertLinkRejected((await follow(expired)).params);

  await pause();
  await requestRecovery(student.email);
  const { params } = await follow(await latestLink(student.email, seen));
  assert.equal(params.get("type"), "recovery");
});

test("a requested email change keeps both emails until it is confirmed, then moves both", async () => {
  const student = await newStudent("change");
  const next = freshEmail("changed");
  const signedIn = client();
  assert.ifError((await signedIn.auth.signInWithPassword({ email: student.email, password: PASSWORD })).error);

  const { data, error } = await signedIn.auth.updateUser({ email: next }, { emailRedirectTo: "http://localhost:5173/profile" });
  assert.ifError(error);
  assert.equal(data.user.email, student.email);
  assert.deepEqual(await emails(student.id), { auth: student.email, pending: next, profile: student.email });

  const toNew = await latestLink(next);
  const toCurrent = await latestLink(student.email);
  assert.equal((await follow(toNew)).location.pathname, "/profile");
  const halfway = await emails(student.id);
  assert.equal(halfway.profile, halfway.auth, "the profile follows Auth after the first confirmation link");
  assert.equal((await follow(toCurrent)).location.pathname, "/profile");

  const confirmed = await emails(student.id);
  assert.equal(confirmed.auth, next);
  assert.equal(confirmed.profile, next);
  assert.equal(await signsIn(next, PASSWORD), true, "the confirmed email signs in");
});

test("an email change to an address another account uses fails and changes nothing", async () => {
  const student = await newStudent("blocked");
  const other = await newStudent("owner");
  const signedIn = client();
  assert.ifError((await signedIn.auth.signInWithPassword({ email: student.email, password: PASSWORD })).error);

  const { error } = await signedIn.auth.updateUser({ email: other.email });
  assert.equal(error?.code, "email_exists");
  assert.deepEqual(await emails(student.id), { auth: student.email, pending: null, profile: student.email });
});

test("a signed-in student cannot write the profile email directly", async () => {
  const student = await newStudent("direct");
  const signedIn = client();
  assert.ifError((await signedIn.auth.signInWithPassword({ email: student.email, password: PASSWORD })).error);

  const { error } = await signedIn.from("users").update({ email: freshEmail("forged") }).eq("id", student.id);
  assert.equal(error?.code, "42501");
  assert.equal((await emails(student.id)).profile, student.email);
});
