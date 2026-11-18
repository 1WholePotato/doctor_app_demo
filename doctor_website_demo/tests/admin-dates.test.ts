import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "../src/lib/adminBookings";

const originalTimeZone = process.env.TZ;

beforeAll(() => {
  process.env.TZ = "Africa/Johannesburg";
});

afterAll(() => {
  process.env.TZ = originalTimeZone;
});

describe("admin date formatting", () => {
  it("reads a zone-less database timestamp as UTC", () => {
    expect(formatDateTime("2026-11-18T11:50:00")).toContain("13:50");
    expect(formatDateTime("2026-11-18 11:50:00.123456")).toContain("13:50");
  });

  it("keeps an explicit offset", () => {
    expect(formatDateTime("2026-11-18T11:50:00+00:00")).toContain("13:50");
  });

  it("puts a booking made just after local midnight on the local day", () => {
    expect(formatDate("2026-11-17T23:30:00")).toContain("18");
  });

  it("leaves a plain calendar date on that date", () => {
    expect(formatDate("2026-11-18")).toContain("18");
  });
});
