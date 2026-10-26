   
                                                        
  
                                                                            
                                                                              
                                                        
   

                                                                                                        
export type Gains = Record<string, number>;

export function precisionAtK(ranked: string[], gains: Gains, k: number): number {
  const top = ranked.slice(0, k);
  if (!top.length) return 0;
  return top.filter((id) => (gains[id] ?? 0) > 0).length / top.length;
}

export function recallAtK(ranked: string[], gains: Gains, k: number): number {
  const relevant = Object.keys(gains).filter((id) => (gains[id] ?? 0) > 0);
  if (!relevant.length) return 1;
  const top = new Set(ranked.slice(0, k));
  return relevant.filter((id) => top.has(id)).length / relevant.length;
}

                                                                           
export function dcg(ranked: string[], gains: Gains, k: number): number {
  let sum = 0;
  ranked.slice(0, k).forEach((id, i) => {
    const g = gains[id] ?? 0;
    if (g > 0) sum += (Math.pow(2, g) - 1) / Math.log2(i + 2);
  });
  return sum;
}

                                                                                      
export function ndcgAtK(ranked: string[], gains: Gains, k: number): number {
  const ideal = Object.entries(gains)
    .filter(([, g]) => g > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
  const best = dcg(ideal, gains, k);
  if (best === 0) return 1;
  return dcg(ranked, gains, k) / best;
}

                                                         
export function reciprocalRank(ranked: string[], gains: Gains): number {
  for (let i = 0; i < ranked.length; i++) {
    if ((gains[ranked[i]!] ?? 0) > 0) return 1 / (i + 1);
  }
  return 0;
}

export type EvalReport = {
  profiles: number;
  k: number;
  precision: number;
  recall: number;
  ndcg: number;
  mrr: number;
  perProfile: { name: string; precision: number; recall: number; ndcg: number; rr: number }[];
};

export function evaluate(
  cases: { name: string; ranked: string[]; gains: Gains }[],
  k = 10,
): EvalReport {
  const perProfile = cases.map((c) => ({
    name: c.name,
    precision: precisionAtK(c.ranked, c.gains, k),
    recall: recallAtK(c.ranked, c.gains, k),
    ndcg: ndcgAtK(c.ranked, c.gains, k),
    rr: reciprocalRank(c.ranked, c.gains),
  }));
  const mean = (f: (x: (typeof perProfile)[number]) => number) =>
    perProfile.reduce((s, x) => s + f(x), 0) / Math.max(perProfile.length, 1);
  return {
    profiles: cases.length,
    k,
    precision: mean((x) => x.precision),
    recall: mean((x) => x.recall),
    ndcg: mean((x) => x.ndcg),
    mrr: mean((x) => x.rr),
    perProfile,
  };
}
