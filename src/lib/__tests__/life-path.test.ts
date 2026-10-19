import { describe, expect, it } from "vitest";
import { createFallbackLifePaths } from "../ascend.functions";

describe("life path fallback", () => {
  it("always returns the requested number of usable roadmap years", () => {
    const result = createFallbackLifePaths("Physician", "Biology", 4);
    expect(result.paths).toHaveLength(1);
    expect(result.paths[0]?.milestones).toHaveLength(4);
    expect(result.paths[0]?.milestones.map((step) => step.year)).toEqual([1, 2, 3, 4]);
  });
});