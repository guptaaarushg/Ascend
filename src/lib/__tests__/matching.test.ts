import { describe, expect, it } from "vitest";
import {
  buildIdf,
  obviouslyIneligible,
  preRankScore,
  profileTerms,
  shortlistOpportunities,
  tokenize,
  type RankableOpportunity,
} from "@/lib/matching";

const opp = (o: Partial<RankableOpportunity> & { id: string; title: string }): RankableOpportunity => ({
  category: "scholarship",
  eligibility: "Open to all high school students",
  description: "",
  tags: [],
  related_skills: [],
  ...o,
});

const profile = {
  education_level: "high_school",
  academic_interests: ["Biology"],
  career_interests: ["Physician"],
  intended_major: "Biology",
  certifications: ["USABO Semifinalist"],
  socioeconomic_info: "Low income, first generation",
  needs_full_ride: true,
  dream_colleges: ["Stanford"],
};

describe("tokenize", () => {
  it("drops stopwords and short tokens", () => {
    expect(tokenize("The summer program for high school students")).toEqual([]);
  });
  it("keeps meaningful terms", () => {
    expect(tokenize("Biology research fellowship")).toContain("biology");
  });
});

describe("obviouslyIneligible", () => {
  it("drops graduate-only programs for a high schooler", () => {
    expect(obviouslyIneligible(opp({ id: "a", title: "Fellowship", eligibility: "PhD only" }), profile)).toBe(true);
  });
  it("keeps open programs", () => {
    expect(obviouslyIneligible(opp({ id: "b", title: "Scholarship" }), profile)).toBe(false);
  });
  it("does not guess citizenship when the profile is silent", () => {
    const o = opp({ id: "c", title: "Award", eligibility: "US citizens only" });
    expect(obviouslyIneligible(o, profile)).toBe(false);
    expect(obviouslyIneligible(o, { ...profile, immigration_status_note: "no SSN" })).toBe(true);
  });
});

describe("preRankScore", () => {
  const pool = [
    opp({ id: "1", title: "Biology Research Scholars", description: "biology research for aspiring physicians" }),
    opp({ id: "2", title: "Marching Band Uniform Fund", description: "uniform stipend for band members" }),
  ];
  const idf = buildIdf(pool);
  const terms = profileTerms(profile);

  it("ranks a topical match above an unrelated one", () => {
    expect(preRankScore(pool[0], terms, idf, profile)).toBeGreaterThan(preRankScore(pool[1], terms, idf, profile));
  });

  it("rewards free-to-apply programs for students who need a full ride", () => {
    const free = preRankScore(opp({ id: "3", title: "Biology Scholars", application_fee: 0 }), terms, idf, profile);
    const paid = preRankScore(opp({ id: "4", title: "Biology Scholars", application_fee: 75 }), terms, idf, profile);
    expect(free).toBeGreaterThan(paid);
  });

  it("surfaces foster-specific funds only when the flag is set", () => {
    const fosterOpp = opp({ id: "5", title: "Foster Youth Education Voucher", description: "ETV funds" });
    const withFlag = preRankScore(fosterOpp, terms, idf, { ...profile, foster_youth_status: true });
    const without = preRankScore(fosterOpp, terms, idf, profile);
    expect(withFlag).toBeGreaterThan(without);
  });
});

describe("shortlistOpportunities", () => {
  const many: RankableOpportunity[] = Array.from({ length: 400 }, (_, i) =>
    opp({
      id: String(i),
      title: i % 2 === 0 ? `Biology Scholars ${i}` : `Robotics Internship ${i}`,
      category: i % 2 === 0 ? "scholarship" : "internship",
    }),
  );

  it("caps the shortlist at the requested size", () => {
    expect(shortlistOpportunities(many, profile, 120)).toHaveLength(120);
  });

  it("diversifies across categories instead of one lane", () => {
    const picked = shortlistOpportunities(many, profile, 120);
    const cats = new Set(picked.map((p) => p.category));
    expect(cats.size).toBeGreaterThan(1);
  });

  it("never returns obviously ineligible rows", () => {
    const withBad = [...many, opp({ id: "bad", title: "Postdoc Award", eligibility: "Doctoral only" })];
    expect(shortlistOpportunities(withBad, profile, 400).some((o) => o.id === "bad")).toBe(false);
  });
});
