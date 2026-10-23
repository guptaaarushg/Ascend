import { describe, it, expect } from "vitest";
import { tablesToLists } from "@/lib/chat-format";

describe("tablesToLists", () => {
  it("turns a markdown table into a bullet list", () => {
    const input = [
      "2. Build a focused problem library",
      "| Source | Why it fits you | How to use it |",
      "|--------|-----------------|---------------|",
      "| **Past USAMO problems** | Matches the style you face | Solve one every other day |",
      "| AoPS threads | Multiple approaches | Read the top 2 solutions |",
      "",
      "3. Schedule a weekly sprint",
    ].join("\n");
    const out = tablesToLists(input);
    expect(out).not.toContain("|--");
    expect(out).toContain("- **Past USAMO problems** - Why it fits you: Matches the style you face | How to use it: Solve one every other day");
    expect(out).toContain("- **AoPS threads** - Why it fits you: Multiple approaches | How to use it: Read the top 2 solutions");
    expect(out).toContain("3. Schedule a weekly sprint");
  });
  it("leaves normal text and single pipes alone", () => {
    const input = "Use A | B in your notes.\n\n- one\n- two";
    expect(tablesToLists(input)).toBe(input);
  });
  it("handles a table that ends the message", () => {
    const out = tablesToLists("| Day | Activity |\n|---|---|\n| Monday | Geometry review |");
    expect(out).toContain("- **Monday** - Activity: Geometry review");
  });
});
