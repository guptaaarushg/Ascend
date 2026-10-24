import { describe, expect, it } from "vitest";
import { barrierFacts, formatFormat, isZeroBarrier } from "../barriers";

describe("isZeroBarrier", () => {
  it("is true when the program is free to apply and needs no travel", () => {
    expect(isZeroBarrier({ application_fee: 0, travel_required: false })).toBe(true);
  });

  it("is true when a fee exists but a waiver is available", () => {
    expect(isZeroBarrier({ application_fee: 75, fee_waiver_available: true, travel_required: false })).toBe(true);
  });

  it("is false when a fee exists with no waiver", () => {
    expect(isZeroBarrier({ application_fee: 75, fee_waiver_available: false, travel_required: false })).toBe(false);
  });

  it("is false when travel is required, even with no fee", () => {
    expect(isZeroBarrier({ application_fee: 0, travel_required: true })).toBe(false);
  });

  it("is false when the fee is unknown, never guesses free", () => {
    expect(isZeroBarrier({ application_fee: null, travel_required: false })).toBe(false);
    expect(isZeroBarrier(null)).toBe(false);
  });

  it("does not count programs whose travel is unknown", () => {
    expect(isZeroBarrier({ application_fee: 0, travel_required: null })).toBe(false);
    expect(isZeroBarrier({ application_fee: 0 })).toBe(false);
    expect(isZeroBarrier({ application_fee: 0, travel_required: null, format: "hybrid" })).toBe(false);
  });

  it("counts fully virtual programs even when travel is not stated", () => {
    expect(isZeroBarrier({ application_fee: 0, travel_required: null, format: "virtual" })).toBe(true);
  });
});

describe("barrierFacts", () => {
  it("marks an unlisted fee as unknown rather than free", () => {
    const fee = barrierFacts({ application_fee: null }).find((f) => f.label === "Application fee");
    expect(fee?.tone).toBe("unknown");
  });

  it("flags a real unwaived fee as a warning", () => {
    const fee = barrierFacts({ application_fee: 50 }).find((f) => f.label === "Application fee");
    expect(fee?.tone).toBe("warn");
    expect(fee?.value).toContain("50");
  });
});

describe("formatFormat", () => {
  it("maps stored codes to student-facing words", () => {
    expect(formatFormat("virtual")).toBe("Fully virtual");
    expect(formatFormat("in_person")).toBe("In person");
    expect(formatFormat(null)).toBeNull();
  });
});
