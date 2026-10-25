import { describe, it, expect } from "vitest";
import { dbCategoriesFor, normalizeCategory, OPPORTUNITY_CATEGORIES } from "@/lib/categories";

describe("category mapping", () => {
  it("sends resource-style legacy labels to benefits, not volunteering", () => {
    expect(normalizeCategory("community_resource")).toBe("benefit");
    expect(normalizeCategory("tutoring")).toBe("mentorship");
  });
  it("lists every stored label that belongs to a category", () => {
    expect(dbCategoriesFor("benefit")).toEqual(expect.arrayContaining(["benefit", "government_benefit", "tax_credit", "community_resource"]));
    expect(dbCategoriesFor("mentorship")).toEqual(expect.arrayContaining(["mentorship", "tutoring"]));
    expect(dbCategoriesFor("grant")).toEqual(expect.arrayContaining(["grant", "funding"]));
  });
  it("always includes the category itself", () => {
    for (const c of OPPORTUNITY_CATEGORIES) expect(dbCategoriesFor(c.id)).toContain(c.id);
  });
});
