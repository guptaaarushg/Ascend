/**
 * "What it actually takes", the hidden costs that quietly lock students out.
 *
 * A program can be free on paper and still be out of reach: a $75 application
 * fee, a plane ticket, or a laptop you do not own. These helpers surface that
 * up front instead of burying it in a description paragraph.
 */

export type BarrierFields = {
  application_fee?: number | null;
  fee_waiver_available?: boolean | null;
  travel_required?: boolean | null;
  equipment_needed?: string | null;
  format?: string | null;
};

export type BarrierFact = {
  label: string;
  value: string;
  /** "good" = no barrier, "warn" = a real cost, "unknown" = not stated on the source page. */
  tone: "good" | "warn" | "unknown";
};

export function formatFormat(format?: string | null): string | null {
  if (format === "virtual") return "Fully virtual";
  if (format === "in_person") return "In person";
  if (format === "hybrid") return "Hybrid";
  return null;
}

/**
 * A "$0 barrier" opportunity: no application fee to pay (or a waiver exists)
 * and no travel required. Unknown fee data does not qualify, because telling a
 * student something is free when we do not know is worse than saying nothing.
 */
export function isZeroBarrier(o: BarrierFields | null | undefined): boolean {
  if (!o) return false;
  const feeClear = o.application_fee === 0 || o.fee_waiver_available === true;
  const travelClear = o.travel_required === false || o.format === "virtual";
  return feeClear && travelClear;
}

export function barrierFacts(o: BarrierFields | null | undefined): BarrierFact[] {
  if (!o) return [];
  const facts: BarrierFact[] = [];

  if (o.application_fee === 0) {
    facts.push({ label: "Application fee", value: "Free to apply", tone: "good" });
  } else if (typeof o.application_fee === "number" && o.application_fee > 0) {
    facts.push({
      label: "Application fee",
      value: o.fee_waiver_available
        ? `$${o.application_fee.toLocaleString()}, waiver available`
        : `$${o.application_fee.toLocaleString()}`,
      tone: o.fee_waiver_available ? "good" : "warn",
    });
  } else if (o.fee_waiver_available === true) {
    facts.push({ label: "Application fee", value: "Waiver available", tone: "good" });
  } else {
    facts.push({ label: "Application fee", value: "Not listed", tone: "unknown" });
  }

  if (o.travel_required === true) {
    facts.push({ label: "Travel", value: "Travel required", tone: "warn" });
  } else if (o.travel_required === false) {
    facts.push({ label: "Travel", value: "No travel needed", tone: "good" });
  } else {
    facts.push({ label: "Travel", value: "Not listed", tone: "unknown" });
  }

  const fmt = formatFormat(o.format);
  if (fmt) facts.push({ label: "Format", value: fmt, tone: fmt === "Fully virtual" ? "good" : "unknown" });

  if (o.equipment_needed && o.equipment_needed.trim()) {
    facts.push({ label: "You will need", value: o.equipment_needed.trim(), tone: "warn" });
  } else if (o.equipment_needed === null || o.equipment_needed === undefined) {
    facts.push({ label: "Equipment", value: "Not listed", tone: "unknown" });
  }

  return facts;
}
