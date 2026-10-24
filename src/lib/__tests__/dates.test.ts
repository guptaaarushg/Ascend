import { describe, it, expect } from "vitest";
import { daysUntilDeadline, formatDeadline, parseDateOnly, todayPacific } from "@/lib/dates";

describe("parseDateOnly", () => {
  it("keeps the calendar day instead of shifting it by time zone", () => {
    const d = parseDateOnly("2027-03-15");
    expect(d?.getFullYear()).toBe(2027);
    expect(d?.getMonth()).toBe(2);
    expect(d?.getDate()).toBe(15);
  });
  it("returns null for empty or invalid values", () => {
    expect(parseDateOnly(null)).toBeNull();
    expect(parseDateOnly("")).toBeNull();
    expect(parseDateOnly("not a date")).toBeNull();
  });
  it("reads the date part of a full timestamp string", () => {
    expect(parseDateOnly("2027-03-15T00:00:00+00:00")?.getDate()).toBe(15);
  });
});

describe("formatDeadline", () => {
  it("shows the stored day", () => {
    expect(formatDeadline("2027-03-15")).toContain("15");
    expect(formatDeadline(null)).toBe("");
  });
});

describe("daysUntilDeadline", () => {
  it("counts calendar days, not hours", () => {
    const evening = new Date(2026, 9, 23, 21, 30);
    expect(daysUntilDeadline("2026-10-23", evening)).toBe(0);
    expect(daysUntilDeadline("2026-10-24", evening)).toBe(1);
    expect(daysUntilDeadline("2026-11-02", evening)).toBe(10);
    expect(daysUntilDeadline("2026-10-22", evening)).toBe(-1);
  });
  it("returns null without a deadline", () => {
    expect(daysUntilDeadline(null)).toBeNull();
  });
});

describe("todayPacific", () => {
  it("uses the Pacific calendar date, not UTC", () => {
    expect(todayPacific(new Date("2026-10-24T03:30:00Z"))).toBe("2026-10-23");
    expect(todayPacific(new Date("2026-10-24T20:00:00Z"))).toBe("2026-10-24");
  });
});
