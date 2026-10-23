import { normalizeCategory } from "@/lib/categories";

export type SelectivityInput = {
  category?: string | null;
  title?: string | null;
  description?: string | null;
  eligibility?: string | null;
  competitiveness?: string | null;
};

const SELECTIVE_CATEGORIES = new Set(["scholarship", "summer_program", "internship", "research", "fellowship", "grant"]);
const OPEN_RE = /\b(open to (all|anyone|everyone)|no application( required)?|open enrollment|anyone can|first[- ]come,? first[- ]served|automatically (awarded|eligible)|no selection process|all (eligible )?(applicants|students) (receive|are accepted|are admitted))\b/i;
const ENTITLEMENT_RE = /\b(pell grant|entitlement)\b/i;
const CONTEST_RE = /\b(olympiad|contest|competition|hackathon|tournament)\b/i;
const SELECTION_RE = /\b(selected|selective|selection|admitted|admission|acceptance|applicants?|cohort|finalists?)\b/i;

export function hasAcceptanceRate(o: SelectivityInput): boolean {
  if (!SELECTIVE_CATEGORIES.has(normalizeCategory(o.category))) return false;
  const text = `${o.title ?? ""} ${o.description ?? ""} ${o.eligibility ?? ""}`;
  if (OPEN_RE.test(text) || ENTITLEMENT_RE.test(text)) return false;
  if ((o.competitiveness ?? "").toLowerCase() === "open") return false;
  if (CONTEST_RE.test(o.title ?? "") && !SELECTION_RE.test(`${o.description ?? ""} ${o.eligibility ?? ""}`)) return false;
  return true;
}

export function noAcceptanceNote(o: SelectivityInput): string {
  const cat = normalizeCategory(o.category);
  if (cat === "competition") {
    return "This is an open competition, so there is no acceptance rate. You enter by registering, and your results decide how far you go. Check the official site for the format, the registration deadline, and past qualifying scores.";
  }
  if (cat === "certification") {
    return "This is earned by passing an exam or finishing the requirements, so there is no acceptance rate.";
  }
  if (cat === "benefit" || cat === "community_resource" || ENTITLEMENT_RE.test(`${o.title ?? ""} ${o.description ?? ""}`)) {
    return "This is based on eligibility, not selection, so there is no acceptance rate. If you meet the requirements, you can apply.";
  }
  return "This program does not publish an acceptance rate, so we do not estimate one.";
}
