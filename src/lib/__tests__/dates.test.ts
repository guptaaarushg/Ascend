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

import { buildSchoolYearPlan, gradeFromText, parseSeniorStart } from "@/lib/dates";

describe("parseSeniorStart", () => {
  it("treats an application season as the start of senior year", () => {
    expect(parseSeniorStart("Fall 2027")).toBe(2027);
    expect(parseSeniorStart("2028")).toBe(2028);
  });
  it("treats a class year as graduating the following spring", () => {
    expect(parseSeniorStart("Class of 2028")).toBe(2027);
  });
  it("returns null when no year is given", () => {
    expect(parseSeniorStart("")).toBeNull();
    expect(parseSeniorStart("soon")).toBeNull();
  });
});

describe("gradeFromText", () => {
  it("reads grades and class names", () => {
    expect(gradeFromText("High school junior")).toBe(11);
    expect(gradeFromText("10th grade")).toBe(10);
    expect(gradeFromText("High School")).toBeNull();
  });
});

describe("buildSchoolYearPlan", () => {
  it("anchors years to school years and grades from the application year", () => {
    const plan = buildSchoolYearPlan({ today: "2026-10-23", years: 4, eduLevel: "high_school", applicationText: "Fall 2027" });
    expect(plan.map((p) => p.schoolYear)).toEqual(["2026-27", "2027-28", "2028-29", "2029-30"]);
    expect(plan.map((p) => p.stage)).toEqual(["11th grade", "12th grade", "college year 1", "college year 2"]);
  });
  it("never puts a high-school student in college before graduating", () => {
    const plan = buildSchoolYearPlan({ today: "2026-10-23", years: 8, eduLevel: "high_school", applicationText: "Fall 2028" });
    expect(plan[0].stage).toBe("10th grade");
    expect(plan[2].stage).toBe("12th grade");
    expect(plan[3].stage).toBe("college year 1");
    expect(plan[7].stage).toBe("after college year 4");
  });
  it("uses the school year that began in August when today is in the spring", () => {
    const plan = buildSchoolYearPlan({ today: "2027-03-10", years: 2, eduLevel: "high_school", educationText: "11th grade" });
    expect(plan[0].schoolYear).toBe("2026-27");
    expect(plan[0].stage).toBe("11th grade");
  });
  it("leaves stages empty when the grade is unknown", () => {
    const plan = buildSchoolYearPlan({ today: "2026-10-23", years: 3, eduLevel: "high_school" });
    expect(plan.every((p) => p.stage === null)).toBe(true);
  });
  it("does not guess stages for other education levels", () => {
    const plan = buildSchoolYearPlan({ today: "2026-10-23", years: 2, eduLevel: "undergraduate", applicationText: "Fall 2027" });
    expect(plan.every((p) => p.stage === null)).toBe(true);
  });
});
