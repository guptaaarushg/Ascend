/**
 * Normalize the dollar-amount badge shown on opportunity cards so that the
 * number on the chip matches the phrasing in the description.
 *
 * Heuristic:
 *  - If the description mentions a per-year dollar amount (e.g. "$55,000/year",
 *    "up to $7,395 per year", "$10k annually"), prefer THAT number and label "/yr".
 *  - Else, if the description mentions a multi-year total (e.g. "over 4 years",
 *    "4-year total", "lifetime"), keep value_usd but label it "total".
 *  - Else, fall back to value_usd with no suffix.
 *
 * This prevents the mismatch where the description says "$55,000/year" but the
 * badge shows "$220,000" (the 4-year total).
 */
export type OpportunityValue = {
  amount: number;
  /** Short suffix shown after the number, e.g. "/yr", "total", or "". */
  unit: "/yr" | "total" | "";
  /** Human label, e.g. "Per year", "Total value", "Award value". */
  label: string;
};

const NUM = /\$?\s*([\d,]+(?:\.\d+)?)\s*(k|m)?/i;

function parseAmount(raw: string, mag?: string): number | null {
  const n = Number(raw.replace(/,/g, ""));
  if (!isFinite(n)) return null;
  const m = (mag ?? "").toLowerCase();
  if (m === "k") return Math.round(n * 1_000);
  if (m === "m") return Math.round(n * 1_000_000);
  return Math.round(n);
}

export function normalizeOpportunityValue(
  valueUsd: number | null | undefined,
  description?: string | null,
): OpportunityValue | null {
  const desc = (description ?? "").toString();

  // 1. Look for a per-year dollar phrase in the description.
  //    Matches: "$55,000/year", "$55,000 per year", "up to $7,395 a year",
  //             "$10k annually", "$1,000 yearly".
  const perYearRe =
    /\$\s*([\d,]+(?:\.\d+)?)\s*(k|m)?\s*(?:\/|per\s+|a\s+|each\s+|every\s+)?\s*(?:year|yr|annually|yearly|annum)/i;
  const py = desc.match(perYearRe);
  if (py) {
    const amt = parseAmount(py[1], py[2]);
    if (amt && amt > 0) return { amount: amt, unit: "/yr", label: "Per year" };
  }

  // 2. If description signals a multi-year / total figure, label value_usd as "total".
  const totalRe =
    /(?:over\s+\d+\s*years|across\s+\d+\s*years|\d+[\s-]year\s+(?:total|award|value)|total\s+(?:award|value|of)|lifetime\s+(?:award|value)|cumulative)/i;
  if (typeof valueUsd === "number" && valueUsd > 0 && totalRe.test(desc)) {
    return { amount: valueUsd, unit: "total", label: "Total value" };
  }

  if (typeof valueUsd === "number" && valueUsd > 0) {
    return { amount: valueUsd, unit: "", label: "Award value" };
  }
  return null;
}

export function formatOpportunityValue(v: OpportunityValue): string {
  const n = `$${v.amount.toLocaleString()}`;
  if (v.unit === "/yr") return `${n}/yr`;
  if (v.unit === "total") return `${n} total`;
  return n;
}
