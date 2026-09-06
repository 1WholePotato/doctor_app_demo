#!/usr/bin/env node
/**
 * Idempotent demo seed for doctor_website_demo.
 * Reads .env.local from doctor_website_demo (never prints secrets).
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env.local");

const ADMIN_ROLE_ID = "ef387d99-bdbd-4304-b6ab-946b58475aa1";
const STUDENT_ROLE_ID = "4fd9e72e-f94b-4222-b5c1-95b447088d4d";
const DEMO_PASSWORD = "DemoPass1234";
const ADMIN_EMAIL = "doctor.demo.admin@gmail.com";
const STUDENT_EMAIL = "doctor.demo.student@gmail.com";

function loadEnvFile(path) {
  if (!existsSync(path)) {
    console.error(`Missing ${path}`);
    process.exit(1);
  }
  const env = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function logOk(msg) {
  console.log(`✓ ${msg}`);
}

function logWarn(msg) {
  console.warn(`⚠ ${msg}`);
}

function logFail(msg) {
  console.error(`✗ ${msg}`);
}

async function ensureAuthUser(supabase, email, password, metadata) {
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInData.user) {
    logOk(`Signed in existing auth user: ${email}`);
    return signInData.user;
  }

  const unconfirmed = signInError?.message.toLowerCase().includes("email not confirmed");
  if (unconfirmed) {
    logWarn(`${email} exists but is unconfirmed`);
  } else if (
    signInError &&
    !signInError.message.toLowerCase().includes("invalid login credentials")
  ) {
    logWarn(`Sign-in check for ${email}: ${signInError.message}`);
  }

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: metadata },
  });

  if (signUpData.user) {
    logOk(`Have auth user id for ${email}`);
    return signUpData.user;
  }

  if (signUpError) {
    throw new Error(`Could not create auth user ${email}: ${signUpError.message}`);
  }

  throw new Error(`Auth sign-up returned no user for ${email}`);
}

async function upsertProfile(supabase, userId, profile) {
  const { data: existing, error: fetchError } = await supabase
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Profile lookup failed: ${fetchError.message}`);
  }

  if (existing) {
    const { error } = await supabase.from("users").update(profile).eq("id", userId);
    if (error) throw new Error(`Profile update failed: ${error.message}`);
    logOk(`Updated users profile for ${profile.email}`);
    return;
  }

  const { error } = await supabase.from("users").insert({ id: userId, ...profile });
  if (error) throw new Error(`Profile insert failed: ${error.message}`);
  logOk(`Inserted users profile for ${profile.email}`);
}

async function findByTitle(supabase, table, titleColumn, title) {
  const { data, error } = await supabase.from(table).select("id").eq(titleColumn, title).maybeSingle();
  if (error) throw new Error(`${table} lookup failed: ${error.message}`);
  return data?.id ?? null;
}

async function ensureInstructor(supabase, instructor) {
  const existingId = await findByTitle(supabase, "instructors", "email", instructor.email);
  if (existingId) {
    logOk(`Instructor exists: ${instructor.email}`);
    return existingId;
  }

  const { data, error } = await supabase.from("instructors").insert(instructor).select("id").single();
  if (error) throw new Error(`Instructor insert failed: ${error.message}`);
  logOk(`Inserted instructor: ${instructor.email}`);
  return data.id;
}

async function ensureCourse(supabase, course) {
  const existingId = await findByTitle(supabase, "courses", "course_title", course.course_title);
  if (existingId) {
    logOk(`Course exists: ${course.course_title}`);
    return existingId;
  }

  const { data, error } = await supabase.from("courses").insert(course).select("id").single();
  if (error) throw new Error(`Course insert failed: ${error.message}`);
  logOk(`Inserted course: ${course.course_title}`);
  return data.id;
}

async function ensureLocation(supabase) {
  const name = "Cape Town Medical Centre";
  const existingId = await findByTitle(supabase, "locations", "name", name);
  if (existingId) {
    logOk("Location exists");
    return existingId;
  }

  const { data, error } = await supabase
    .from("locations")
    .insert({ name, address: "Room 4A, Cape Town Medical Centre" })
    .select("id")
    .single();

  if (error) throw new Error(`Location insert failed: ${error.message}`);
  logOk("Inserted demo location");
  return data.id;
}

async function ensureSession(supabase, courseId, instructorId, locationId) {
  const { data: existing, error: fetchError } = await supabase
    .from("course_sessions")
    .select("id")
    .eq("course_id", courseId)
    .eq("instructor_id", instructorId)
    .maybeSingle();

  if (fetchError) throw new Error(`Session lookup failed: ${fetchError.message}`);
  if (existing) {
    logOk(`Session exists for course ${courseId}`);
    return existing.id;
  }

  const { data, error } = await supabase
    .from("course_sessions")
    .insert({
      course_id: courseId,
      instructor_id: instructorId,
      location_id: locationId,
      start_date: "2026-10-14",
      end_date: "2026-10-14",
      start_time: "09:00:00",
      end_time: "12:00:00",
      active: true,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Session insert failed: ${error.message}`);
  logOk(`Inserted session for course ${courseId}`);
  return data.id;
}

async function ensureBooking(supabase, userId, courseId, paymentStatus) {
  const { data: existing, error: fetchError } = await supabase
    .from("bookings")
    .select("id, payment_status")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (fetchError) throw new Error(`Booking lookup failed: ${fetchError.message}`);

  if (existing) {
    if (existing.payment_status !== paymentStatus) {
      const { error } = await supabase
        .from("bookings")
        .update({ payment_status: paymentStatus })
        .eq("id", existing.id);
      if (error) throw new Error(`Booking update failed: ${error.message}`);
      logOk(`Updated booking payment_status → ${paymentStatus}`);
    } else {
      logOk(`Booking exists (${paymentStatus}) for course ${courseId}`);
    }
    return existing.id;
  }

  const { data, error } = await supabase
    .from("bookings")
    .insert({ user_id: userId, course_id: courseId, payment_status: paymentStatus })
    .select("id")
    .single();

  if (error) throw new Error(`Booking insert failed: ${error.message}`);
  logOk(`Inserted booking (${paymentStatus}) for course ${courseId}`);
  return data.id;
}

async function ensurePayment(supabase, bookingId, amount) {
  const { data: existing, error: fetchError } = await supabase
    .from("payments")
    .select("id")
    .eq("booking_id", bookingId)
    .maybeSingle();

  if (fetchError) {
    logWarn(`Payment lookup skipped: ${fetchError.message}`);
    return null;
  }

  if (existing) {
    logOk(`Payment exists for booking ${bookingId}`);
    return existing.id;
  }

  const { data, error } = await supabase
    .from("payments")
    .insert({ booking_id: bookingId, amount })
    .select("id")
    .single();

  if (error) {
    logWarn(`Payment insert failed: ${error.message}`);
    return null;
  }

  logOk(`Inserted payment for booking ${bookingId}`);
  return data.id;
}

async function seedCatalog(supabase, studentId) {
  const instructorDefs = [
    { first_name: "Pietie", last_name: "van Wyk", email: "pietie.demo@medlearn.test", cell_num: "0823000001" },
    { first_name: "Sielie", last_name: "Botha", email: "sielie.demo@medlearn.test", cell_num: "0823000002" },
    { first_name: "Mielie", last_name: "Joubert", email: "mielie.demo@medlearn.test", cell_num: "0823000003" },
  ];

  const instructorIds = [];
  for (const instructor of instructorDefs) {
    instructorIds.push(await ensureInstructor(supabase, instructor));
  }

  const locationId = await ensureLocation(supabase);

  const courseDefs = [
    {
      course_title: "Advanced Human Anatomy",
      course_description: "Musculoskeletal systems, organ placement, and clinical correlations.",
      course_price: 1499,
      active: true,
    },
    {
      course_title: "Clinical Pharmacology Essentials",
      course_description: "Drug classes, mechanisms, and prescribing principles.",
      course_price: 1299,
      active: true,
    },
    {
      course_title: "Diagnostic Imaging Fundamentals",
      course_description: "Reading X-rays, CT scans, and MRIs with confidence.",
      course_price: 1799,
      active: true,
    },
  ];

  const courseIds = [];
  for (let i = 0; i < courseDefs.length; i++) {
    const courseId = await ensureCourse(supabase, courseDefs[i]);
    courseIds.push(courseId);
    await ensureSession(supabase, courseId, instructorIds[i % instructorIds.length], locationId);
  }

  if (!studentId) {
    logWarn("Skipping bookings; student user id is not available");
    return;
  }

  const paidBookingId = await ensureBooking(supabase, studentId, courseIds[0], "paid");
  await ensureBooking(supabase, studentId, courseIds[1], "passed");
  await ensureBooking(supabase, studentId, courseIds[2], "failed");
  await ensurePayment(supabase, paidBookingId, courseDefs[0].course_price);
}

async function seedUsers(supabase) {
  const adminAuth = await ensureAuthUser(supabase, ADMIN_EMAIL, DEMO_PASSWORD, {
    first_name: "Demo",
    last_name: "Admin",
  });

  await upsertProfile(supabase, adminAuth.id, {
    email: ADMIN_EMAIL,
    role_id: ADMIN_ROLE_ID,
    first_name: "Demo",
    last_name: "Admin",
    birth_date: "1985-01-15",
    id_num: "8501155800084",
    passport_num: null,
    cell_num: "0821110001",
    sanc_num: "MP123456",
    active: true,
  });

  const { error: adminRolePatchError } = await supabase
    .from("users")
    .update({ role_id: ADMIN_ROLE_ID })
    .eq("id", adminAuth.id);

  if (adminRolePatchError) logWarn(`Admin role_id patch: ${adminRolePatchError.message}`);
  else logOk("Patched admin role_id");

  const studentAuth = await ensureAuthUser(supabase, STUDENT_EMAIL, DEMO_PASSWORD, {
    first_name: "Demo",
    last_name: "Student",
  });

  await upsertProfile(supabase, studentAuth.id, {
    email: STUDENT_EMAIL,
    role_id: STUDENT_ROLE_ID,
    first_name: "Demo",
    last_name: "Student",
    birth_date: "2000-06-20",
    id_num: "0006205800087",
    passport_num: null,
    cell_num: "0822220002",
    sanc_num: "STU0001",
    active: true,
  });

  return studentAuth.id;
}

async function main() {
  const env = loadEnvFile(envPath);
  const url = env.VITE_SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    logFail("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, anonKey);
  let studentId = null;

  try {
    studentId = await seedUsers(supabase);
  } catch (err) {
    logWarn(err instanceof Error ? err.message : String(err));
    logWarn("Confirm demo emails in Supabase Auth, or disable Confirm email, then re-run the seed.");
  }

  try {
    await seedCatalog(supabase, studentId);
    await supabase.auth.signOut();
    logOk("Demo seed finished.");
    console.log("Demo accounts:");
    console.log(`  Admin:   ${ADMIN_EMAIL} / ${DEMO_PASSWORD}`);
    console.log(`  Student: ${STUDENT_EMAIL} / ${DEMO_PASSWORD}`);
  } catch (err) {
    logFail(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

await main();
