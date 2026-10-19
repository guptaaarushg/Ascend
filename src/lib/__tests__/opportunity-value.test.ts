import { describe, expect, it } from "vitest";
import { formatOpportunityValue, normalizeOpportunityValue } from "../opportunity-value";

describe("normalizeOpportunityValue", () => {
  it("prefers a per-year figure stated in the description", () => {
    const v = normalizeOpportunityValue(220000, "Covers $55,000/year for four years.");
    expect(v).toEqual({ amount: 55000, unit: "/yr", label: "Per year" });
  });

  it("understands shorthand amounts like $10k annually", () => {
    const v = normalizeOpportunityValue(null, "Award of $10k annually.");
    expect(v?.amount).toBe(10000);
    expect(v?.unit).toBe("/yr");
  });

  it("labels multi-year sums as a total", () => {
    const v = normalizeOpportunityValue(40000, "A $40,000 award paid over 4 years.");
    expect(v?.unit).toBe("total");
  });

  it("falls back to a plain award value", () => {
    expect(normalizeOpportunityValue(1000, "One time prize.")).toEqual({
      amount: 1000,
      unit: "",
      label: "Award value",
    });
  });

  it("returns nothing when there is no money to show", () => {
    expect(normalizeOpportunityValue(null, "Unpaid research placement.")).toBeNull();
    expect(normalizeOpportunityValue(0, "")).toBeNull();
  });
});

describe("formatOpportunityValue", () => {
  it("renders each unit distinctly", () => {
    expect(formatOpportunityValue({ amount: 55000, unit: "/yr", label: "Per year" })).toBe("$55,000/yr");
    expect(formatOpportunityValue({ amount: 40000, unit: "total", label: "Total value" })).toBe("$40,000 total");
    expect(formatOpportunityValue({ amount: 500, unit: "", label: "Award value" })).toBe("$500");
  });
});
