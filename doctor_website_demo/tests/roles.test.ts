import { describe, it, expect } from "vitest";
import { isAdminRole, type RoleOption } from "../src/lib/roles";
import { homeForRole } from "../src/lib/auth";

describe("Role and Route Guard logic", () => {
  const mockRoles: RoleOption[] = [
    { id: "role-admin-1", name: "Admin" },
    { id: "role-student-1", name: "Student" },
    { id: "role-instructor-1", name: "Instructor" },
  ];

  it("correctly identifies admin roles by role list lookup", () => {
    expect(isAdminRole("role-admin-1", mockRoles)).toBe(true);
    expect(isAdminRole("role-student-1", mockRoles)).toBe(false);
    expect(isAdminRole("role-instructor-1", mockRoles)).toBe(false);
  });

  it("correctly identifies admin roles by name string fallback", () => {
    expect(isAdminRole("arbitrary-id", "admin")).toBe(true);
    expect(isAdminRole("arbitrary-id", "Admin")).toBe(true);
    expect(isAdminRole("arbitrary-id", "student")).toBe(false);
  });

  it("resolves the correct home dashboard for each role", () => {
    expect(homeForRole("role-admin-1", "admin")).toBe("/dashboard");
    expect(homeForRole("role-student-1", "student")).toBe("/studentlanding");
  });
});
