import { describe, it, expect } from "vitest";
import { hasAcceptanceRate, noAcceptanceNote } from "@/lib/selectivity";

describe("hasAcceptanceRate", () => {
  it("is false for open competitions like USACO", () => {
    expect(hasAcceptanceRate({ category: "competition", title: "USA Computing Olympiad (USACO)", description: "A free online programming contest series." })).toBe(false);
  });
  it("is false for certifications and benefits", () => {
    expect(hasAcceptanceRate({ category: "certification", title: "AWS Cloud Practitioner" })).toBe(false);
    expect(hasAcceptanceRate({ category: "benefit", title: "Reduced lunch program" })).toBe(false);
  });
  it("is true for selective scholarships, summer programs, research and internships", () => {
    for (const category of ["scholarship", "summer_program", "research", "internship", "fellowship"]) {
      expect(hasAcceptanceRate({ category, title: "Selective program", description: "Applicants are reviewed by a committee." })).toBe(true);
    }
  });
  it("is false for entitlement style aid and open enrollment programs", () => {
    expect(hasAcceptanceRate({ category: "grant", title: "Federal Pell Grant" })).toBe(false);
    expect(hasAcceptanceRate({ category: "summer_program", title: "Math camp", description: "Open to all students, no application required." })).toBe(false);
  });
  it("is false for contest-like titles with no selection process", () => {
    expect(hasAcceptanceRate({ category: "summer_program", title: "Annual Coding Contest", description: "Register online and compete." })).toBe(false);
  });
  it("normalizes legacy category labels", () => {
    expect(hasAcceptanceRate({ category: "Summer Program", title: "Research Science Institute", description: "Applicants are selected." })).toBe(true);
  });
});

describe("noAcceptanceNote", () => {
  it("explains competitions differently from certifications", () => {
    expect(noAcceptanceNote({ category: "competition" })).toMatch(/open competition/);
    expect(noAcceptanceNote({ category: "certification" })).toMatch(/exam/);
  });
});
