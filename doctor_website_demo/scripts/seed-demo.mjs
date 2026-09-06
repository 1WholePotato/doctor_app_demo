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
const INSTRUCTOR_EMAIL = "doctor.demo.instructor@gmail.com";

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

async function findAuthUserByEmail(admin, email) {
  const needle = email.toLowerCase();
  let page = 1;
  const perPage = 200;

  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Auth user lookup failed: ${error.message}`);

    const users = data?.users ?? [];
    const match = users.find((user) => user.email?.toLowerCase() === needle);
    if (match) return match;
    if (users.length < perPage) return null;

    page += 1;
    if (page > 20) return null;
  }
}

/** Create or update an auth user with email already confirmed. Needs the service role. */
async function ensureAuthUser(admin, email, password, metadata) {
  const existing = await findAuthUserByEmail(admin, email);

  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (error) throw new Error(`Could not confirm auth user ${email}: ${error.message}`);
    logOk(`Forced confirmed auth user: ${email}`);
    return data.user;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (error) throw new Error(`Could not create auth user ${email}: ${error.message}`);
  logOk(`Created confirmed auth user: ${email}`);
  return data.user;
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

async function ensureRole(supabase, name) {
  const { data, error } = await supabase.from("roles").select("id, name");
  if (error) throw new Error(`Role lookup failed: ${error.message}`);

  const existing = (data ?? []).find((row) => row.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    logOk(`Role exists: ${existing.name}`);
    return existing.id;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("roles")
    .insert({ name })
    .select("id, name")
    .single();

  if (insertError || !inserted) {
    throw new Error(`Role insert failed: ${insertError?.message ?? "no row"}`);
  }

  logOk(`Inserted role: ${inserted.name}`);
  return inserted.id;
}

async function instructorCoursesTableReady(supabase) {
  const { error } = await supabase.from("instructor_courses").select("id").limit(1);
  if (!error) return true;

  logWarn("instructor_courses table is missing.");
  logWarn("Run doctor_website_demo/scripts/ensure-instructor-courses.sql in the Supabase SQL editor, then npm run seed again.");
  return false;
}

async function ensureInstructorCourse(supabase, instructorId, courseId) {
  const { data: existing, error: fetchError } = await supabase
    .from("instructor_courses")
    .select("id")
    .eq("instructor_id", instructorId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (fetchError) throw new Error(`instructor_courses lookup failed: ${fetchError.message}`);
  if (existing) {
    logOk(`Instructor already assigned to course ${courseId}`);
    return;
  }

  const { error } = await supabase
    .from("instructor_courses")
    .insert({ instructor_id: instructorId, course_id: courseId });

  if (error) throw new Error(`instructor_courses insert failed: ${error.message}`);
  logOk(`Assigned instructor to course ${courseId}`);
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

  const { data, error } = await supabase.from("instructors").insert({
    ...instructor,
    active: instructor.active ?? true,
  }).select("id").single();
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
      max_students: 20,
      active: true,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Session insert failed: ${error.message}`);
  logOk(`Inserted session for course ${courseId}`);
  return data.id;
}

async function ensureBooking(supabase, userId, courseId, paymentStatus, totalAmount) {
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
        .update({ payment_status: paymentStatus, total_amount: totalAmount })
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
    .insert({
      user_id: userId,
      course_id: courseId,
      payment_status: paymentStatus,
      material_fee: 0,
      total_amount: totalAmount,
    })
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
    return { courseIds, instructorIds };
  }

  const paidBookingId = await ensureBooking(supabase, studentId, courseIds[0], "paid", courseDefs[0].course_price);
  await ensureBooking(supabase, studentId, courseIds[1], "passed", courseDefs[1].course_price);
  await ensureBooking(supabase, studentId, courseIds[2], "failed", courseDefs[2].course_price);
  await ensurePayment(supabase, paidBookingId, courseDefs[0].course_price);
  return { courseIds, instructorIds };
}

async function seedUsers(supabase, instructorRoleId) {
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

  const instructorAuth = await ensureAuthUser(supabase, INSTRUCTOR_EMAIL, DEMO_PASSWORD, {
    first_name: "Demo",
    last_name: "Instructor",
  });

  await upsertProfile(supabase, instructorAuth.id, {
    email: INSTRUCTOR_EMAIL,
    role_id: instructorRoleId,
    first_name: "Demo",
    last_name: "Instructor",
    birth_date: "1988-03-12",
    id_num: "8803125800081",
    passport_num: null,
    cell_num: "0823330003",
    sanc_num: "INS0001",
    active: true,
  });

  const demoTeacherId = await ensureInstructor(supabase, {
    first_name: "Demo",
    last_name: "Instructor",
    email: INSTRUCTOR_EMAIL,
    cell_num: "0823330003",
  });

  return { studentId: studentAuth.id, demoTeacherId };
}

async function main() {
  const env = loadEnvFile(envPath);
  const url = env.VITE_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    logFail("VITE_SUPABASE_URL is required in .env.local");
    process.exit(1);
  }

  if (!serviceRoleKey) {
    logFail("Add SUPABASE_SERVICE_ROLE_KEY to .env.local (not VITE_*).");
    logFail("Dashboard → Project Settings → API → service_role. This key stays local; seed uses it to force-confirm users without turning Confirm email off.");
    process.exit(1);
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const instructorRoleId = await ensureRole(supabase, "instructor");
    const { studentId, demoTeacherId } = await seedUsers(supabase, instructorRoleId);
    const { courseIds, instructorIds } = await seedCatalog(supabase, studentId);

    if (await instructorCoursesTableReady(supabase)) {
      await ensureInstructorCourse(supabase, instructorIds[0], courseIds[0]);
      await ensureInstructorCourse(supabase, instructorIds[1], courseIds[1]);
      await ensureInstructorCourse(supabase, instructorIds[2], courseIds[2]);
      await ensureInstructorCourse(supabase, demoTeacherId, courseIds[0]);
      await ensureInstructorCourse(supabase, demoTeacherId, courseIds[1]);
    }

    logOk("Demo seed finished. Confirm email can stay on.");
    console.log("Demo accounts:");
    console.log(`  Admin:      ${ADMIN_EMAIL} / ${DEMO_PASSWORD}`);
    console.log(`  Student:    ${STUDENT_EMAIL} / ${DEMO_PASSWORD}`);
    console.log(`  Instructor: ${INSTRUCTOR_EMAIL} / ${DEMO_PASSWORD}`);
  } catch (err) {
    logFail(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

await main();
