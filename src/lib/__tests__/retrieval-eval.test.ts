/**
 * Retrieval quality evaluation.
 *
 * These are not unit tests of code paths, they are offline evaluation of
 * recommendation quality against a hand-labeled validation set, run in CI so a
 * ranking regression fails the build the same way a broken function would.
 *
 * The thresholds below are the current committed floor. Raise them when the
 * ranker improves, never lower them to make a failure go away.
 */
import { describe, expect, it } from "vitest";
import { hybridRank, preRankScore, buildIdf, profileTerms, obviouslyIneligible } from "@/lib/matching";
import { FIXTURE_CATALOG, LABELED_CASES } from "@/lib/eval/labeled-set";
import { evaluate } from "@/lib/eval/metrics";

const K = 5;

function rankHybrid(profile: (typeof LABELED_CASES)[number]["profile"]) {
  return hybridRank(FIXTURE_CATALOG, profile).map((r) => r.opportunity.id);
}

/** Lexical-only baseline, i.e. the ranker before the semantic layer existed. */
function rankLexicalOnly(profile: (typeof LABELED_CASES)[number]["profile"]) {
  const candidates = FIXTURE_CATALOG.filter((o) => !obviouslyIneligible(o, profile));
  const idf = buildIdf(candidates);
  const terms = profileTerms(profile);
  return candidates
    .map((o) => ({ o, s: preRankScore(o, terms, idf, profile) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.o.id);
}

const hybridReport = evaluate(
  LABELED_CASES.map((c) => ({ name: c.name, ranked: rankHybrid(c.profile), gains: c.gains })),
  K,
);
const lexicalReport = evaluate(
  LABELED_CASES.map((c) => ({ name: c.name, ranked: rankLexicalOnly(c.profile), gains: c.gains })),
  K,
);

describe("retrieval evaluation on the labeled validation set", () => {
  it("covers at least 30 labeled student profiles", () => {
    expect(LABELED_CASES.length).toBeGreaterThanOrEqual(30);
  });

  it(`meets the committed NDCG@${K} floor`, () => {
    expect(hybridReport.ndcg).toBeGreaterThanOrEqual(0.85);
  });

  it(`meets the committed precision@${K} floor`, () => {
    expect(hybridReport.precision).toBeGreaterThanOrEqual(0.42);
  });

  it(`meets the committed recall@${K} floor`, () => {
    expect(hybridReport.recall).toBeGreaterThanOrEqual(0.78);
  });

  it("puts a relevant program first for most students (MRR)", () => {
    expect(hybridReport.mrr).toBeGreaterThanOrEqual(0.9);
  });

  it("hybrid retrieval beats the lexical-only baseline", () => {
    expect(hybridReport.ndcg).toBeGreaterThan(lexicalReport.ndcg);
  });

  it("prints the report so regressions are readable in CI output", () => {
    const fmt = (n: number) => n.toFixed(3);
    console.log(
      `\nretrieval eval (k=${K}, ${hybridReport.profiles} profiles)\n` +
        `  hybrid  ndcg=${fmt(hybridReport.ndcg)} p=${fmt(hybridReport.precision)} r=${fmt(hybridReport.recall)} mrr=${fmt(hybridReport.mrr)}\n` +
        `  lexical ndcg=${fmt(lexicalReport.ndcg)} p=${fmt(lexicalReport.precision)} r=${fmt(lexicalReport.recall)} mrr=${fmt(lexicalReport.mrr)}\n`,
    );
    expect(hybridReport.profiles).toBe(LABELED_CASES.length);
  });
});
