import { describe, expect, it } from "vitest";
import { containsProfanity } from "../profanity";
import { firstError, inviteCodeSchema, profileSchema, sanitizeText } from "../validation";

describe("containsProfanity", () => {
  it("catches slurs and vulgar words", () => {
    expect(containsProfanity("what the fuck")).toBe(true);
    expect(containsProfanity("you are a b1tch")).toBe(true); // leetspeak is normalized
    expect(containsProfanity("f@ggot")).toBe(true);
  });

  it("allows ordinary student writing", () => {
    expect(containsProfanity("I want to study biology and help my community")).toBe(false);
    expect(containsProfanity("this scholarship process is a pain")).toBe(false);
  });

  it("deliberately allows the mild word we agreed on", () => {
    expect(containsProfanity("this is shit hard")).toBe(false);
  });

  it("handles empty input", () => {
    expect(containsProfanity("")).toBe(false);
  });
});

describe("sanitizeText", () => {
  it("trims and coerces non-strings", () => {
    expect(sanitizeText("  hello  ")).toBe("hello");
    expect(sanitizeText(null)).toBe("");
    expect(sanitizeText(42)).toBe("42");
  });

  it("strips control characters that break exports", () => {
    expect(sanitizeText("clean\u0000text")).not.toContain("\u0000");
  });
});

describe("schemas", () => {
  it("rejects an oversized bio", () => {
    const res = profileSchema.safeParse({ bio: "x".repeat(100000) });
    expect(res.success).toBe(false);
    if (!res.success) expect(firstError(res.error)).toBeTruthy();
  });

  it("normalizes invite codes", () => {
    const res = inviteCodeSchema.safeParse("  ab12cd  ");
    expect(res.success).toBe(true);
  });
});
