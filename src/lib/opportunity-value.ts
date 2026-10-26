   
                                                                           
                                                              
  
             
                                                                                
                                                                                    
                                                                                
                                                                       
                                                  
  
                                                                               
                                             
   
export type OpportunityValue = {
  amount: number;
                                                                         
  unit: "/yr" | "total" | "";
                                                                    
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

                                                             
                                                                           
                                                  
  const perYearRe =
    /\$\s*([\d,]+(?:\.\d+)?)\s*(k|m)?\s*(?:\/|per\s+|a\s+|each\s+|every\s+)?\s*(?:year|yr|annually|yearly|annum)/i;
  const py = desc.match(perYearRe);
  if (py) {
    const amt = parseAmount(py[1], py[2]);
    if (amt && amt > 0) return { amount: amt, unit: "/yr", label: "Per year" };
  }

                                                                                       
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
