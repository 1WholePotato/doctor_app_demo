import { beforeEach, describe, expect, it, vi } from "vitest";

let tableResponse: { data: unknown; error: { message: string } | null } = { data: [], error: null };
let rpcResponse: { error: { message: string } | null } = { error: null };
const rpcCalls: { name: string; args: unknown }[] = [];

vi.mock("../src/supabaseClient", () => ({
  supabase: {
    from() {
      const query = {
        then(resolve: (value: unknown) => unknown) {
          return Promise.resolve(tableResponse).then(resolve);
        },
      } as Record<string, unknown>;
      for (const method of ["select", "eq", "order"]) query[method] = () => query;
      return query;
    },
    rpc(name: string, args: unknown) {
      rpcCalls.push({ name, args });
      return Promise.resolve(rpcResponse);
    },
  },
}));

const { fetchInstructorsForCourse, setSessionInstructors } = await import("../src/lib/instructorCourses");

beforeEach(() => {
  tableResponse = { data: [], error: null };
  rpcResponse = { error: null };
  rpcCalls.length = 0;
});

describe("fetchInstructorsForCourse", () => {
  it("offers no instructors when nobody is authorized for the course", async () => {
    const { instructors, error } = await fetchInstructorsForCourse("course-1");

    expect(error).toBeNull();
    expect(instructors).toEqual([]);
  });

  it("returns the authorized instructors without their authorization rows", async () => {
    tableResponse = {
      error: null,
      data: [{ id: "i-1", first_name: "Thandi", last_name: "Mokoena", email: "t@example.test", instructor_courses: [{ course_id: "course-1" }] }],
    };

    const { instructors } = await fetchInstructorsForCourse("course-1");

    expect(instructors).toEqual([{ id: "i-1", first_name: "Thandi", last_name: "Mokoena", email: "t@example.test" }]);
  });
});

describe("setSessionInstructors", () => {
  it("replaces a class's instructors in one call", async () => {
    expect(await setSessionInstructors("session-1", ["i-1", "i-2"])).toBeNull();
    expect(rpcCalls).toEqual([
      { name: "set_session_instructors", args: { p_course_session_id: "session-1", p_instructor_ids: ["i-1", "i-2"] } },
    ]);
  });

  it("reports the database's refusal", async () => {
    rpcResponse = { error: { message: "Instructor i-3 is not active and authorized to teach this course" } };

    expect(await setSessionInstructors("session-1", ["i-3"])).toBe("Instructor i-3 is not active and authorized to teach this course");
  });
});
