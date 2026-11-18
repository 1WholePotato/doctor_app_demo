import { beforeEach, describe, expect, it, vi } from "vitest";

const responses = new Map<string, { data: unknown; error: { message: string } | null }>();
const calls: { table: string; method: string; args: unknown[] }[] = [];
const rpcCalls: { name: string; args: unknown }[] = [];
let rpcResponse: { data: unknown; error: { message: string } | null } = { data: [], error: null };

vi.mock("../src/supabaseClient", () => ({
  supabase: {
    from(table: string) {
      const query = {
        then(resolve: (value: unknown) => unknown) {
          return Promise.resolve(responses.get(table) ?? { data: [], error: null }).then(resolve);
        },
      } as Record<string, unknown>;
      for (const method of ["select", "eq", "in", "or", "gte", "order", "update", "maybeSingle"]) {
        query[method] = (...args: unknown[]) => {
          calls.push({ table, method, args });
          return query;
        };
      }
      return query;
    },
    rpc(name: string, args: unknown) {
      rpcCalls.push({ name, args });
      return Promise.resolve(rpcResponse);
    },
  },
}));

const { courseProblem, updateCourse } = await import("../src/lib/courses");
const { fetchStudentCourseDetail, fetchStudentCourses } = await import("../src/lib/studentCourses");

const priceRows = [
  { material_type_id: "mt-e", name: "Electronic", kind: "electronic", course_price: "1499.00", material_fee: "0.00", total_amount: "1499.00" },
  { material_type_id: "mt-p", name: "Printed", kind: "printed", course_price: "1499.00", material_fee: "250.00", total_amount: "1749.00" },
];

beforeEach(() => {
  responses.clear();
  calls.length = 0;
  rpcCalls.length = 0;
  rpcResponse = { data: [], error: null };
});

describe("course printed material fee", () => {
  const draft = { title: "Wound Care", description: "", price: 1499, printedMaterialFee: 250, active: true };

  it("accepts a free or paid printed fee and rejects a negative one", () => {
    expect(courseProblem(draft)).toBeNull();
    expect(courseProblem({ ...draft, printedMaterialFee: 0 })).toBeNull();
    expect(courseProblem({ ...draft, printedMaterialFee: -1 })).toBe("Enter a printed material fee of zero or more.");
    expect(courseProblem({ ...draft, printedMaterialFee: Number.NaN })).toBe("Enter a printed material fee of zero or more.");
  });

  it("saves the printed fee with the course", async () => {
    await updateCourse("course-1", draft);

    expect(calls).toContainEqual({
      table: "courses",
      method: "update",
      args: [{ course_title: "Wound Care", course_description: "", course_price: 1499, printed_material_fee: 250, active: true }],
    });
  });
});

describe("student course detail", () => {
  it("lists electronic and printed material with the database's fee and total", async () => {
    responses.set("courses", { data: { id: "course-1", course_title: "Wound Care", course_description: "", active: true }, error: null });
    rpcResponse = { data: priceRows, error: null };

    const { materials, error } = await fetchStudentCourseDetail("course-1", "student-1");

    expect(error).toBeNull();
    expect(rpcCalls).toEqual([{ name: "course_material_prices", args: { p_course_id: "course-1" } }]);
    expect(materials).toEqual([
      { id: "mt-e", name: "Electronic", fee: 0, total: 1499 },
      { id: "mt-p", name: "Printed", fee: 250, total: 1749 },
    ]);
  });

  it("reports a pricing error instead of showing the course without prices", async () => {
    responses.set("courses", { data: { id: "course-1", course_title: "Wound Care", course_description: "", active: true }, error: null });
    rpcResponse = { data: null, error: { message: "permission denied for function course_material_prices" } };

    await expect(fetchStudentCourseDetail("course-1", "student-1")).resolves.toEqual({
      course: null,
      sessions: [],
      materials: [],
      bookings: [],
      error: "permission denied for function course_material_prices",
    });
  });
});

describe("student bookings", () => {
  it("shows the amount the booking was sold at, not today's course price", async () => {
    responses.set("bookings", {
      error: null,
      data: [{
        id: "booking-1",
        booking_status: "Confirmed",
        total_amount: "1749.00",
        payments: [],
        course_sessions: {
          id: "session-1",
          start_date: "2027-01-10",
          courses: { id: "course-1", course_title: "Wound Care", course_description: "", course_price: 1999 },
          instructors: [],
        },
      }],
    });

    const { courses } = await fetchStudentCourses("student-1");

    expect(courses[0].price).toBe(1749);
  });
});
