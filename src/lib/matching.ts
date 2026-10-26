   
                                                            
  
                                                                            
                                                                              
                                                                                
  
                                                                              
        
                                                                                
                                                                               
                                                                               
                            
                                                                                 
                                                                          
   

import { cosine, embed } from "@/lib/semantic";
import { locationFit, parsePlace, type Place } from "@/lib/location";
import { daysUntilDeadline } from "@/lib/dates";

export type RankableOpportunity = {
  id: string;
  title: string;
  organization?: string | null;
  category?: string | null;
  eligibility?: string | null;
  description?: string | null;
  tags?: string[] | null;
  related_skills?: string[] | null;
  competitiveness?: string | null;
  underrepresented?: boolean | null;
  value_usd?: number | null;
  application_fee?: number | null;
  fee_waiver_available?: boolean | null;
  travel_required?: boolean | null;
  format?: string | null;
  deadline?: string | null;
  location?: string | null;
  remote?: boolean | null;
};

export type RankProfile = {
  education_level?: string | null;
  location?: string | null;
  country?: string | null;
  academic_interests?: string[] | null;
  career_interests?: string[] | null;
  skills?: string[] | null;
  extracurriculars?: string[] | null;
  certifications?: string[] | null;
  intended_major?: string | null;
  long_term_goals?: string | null;
  socioeconomic_info?: string | null;
  dream_colleges?: string[] | null;
  target_colleges?: string[] | null;
  safety_colleges?: string[] | null;
  needs_full_ride?: boolean | null;
  applying_with_financial_aid?: boolean | null;
  foster_youth_status?: boolean | null;
  housing_insecure_status?: boolean | null;
  immigration_status_note?: string | null;
};

const STOPWORDS = new Set([
  "the", "and", "for", "with", "you", "your", "are", "was", "will", "that", "this",
  "from", "into", "have", "has", "not", "all", "any", "who", "how", "our",
  "their", "students", "student", "program", "programs", "opportunity", "opportunities",
  "national", "school", "college", "university", "high", "summer", "youth", "must", "be",
]);

const placeCache = new Map<string, Place>();
function placeFor(p: RankProfile): Place {
  const key = `${p.location ?? ""}|${p.country ?? ""}`;
  let place = placeCache.get(key);
  if (!place) {
    place = parsePlace(p.location, p.country);
    if (placeCache.size > 500) placeCache.clear();
    placeCache.set(key, place);
  }
  return place;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#/ ]+/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

                                                                              
export function profileTerms(p: RankProfile): Map<string, number> {
  const bag = new Map<string, number>();
  const add = (value: unknown, weight: number) => {
    if (!value) return;
    const text = Array.isArray(value) ? value.join(" ") : String(value);
    for (const t of tokenize(text)) bag.set(t, (bag.get(t) ?? 0) + weight);
  };
  add(p.intended_major, 3);
  add(p.career_interests, 3);
  add(p.academic_interests, 2.5);
  add(p.long_term_goals, 2);
  add(p.skills, 1.5);
  add(p.extracurriculars, 1.2);
  add(p.certifications, 1.2);
  add(p.dream_colleges, 2);
  add(p.target_colleges, 1.5);
  add(p.safety_colleges, 1);
  return bag;
}

                                                                             
export function buildIdf(opps: RankableOpportunity[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const o of opps) {
    const seen = new Set(tokenize(oppText(o)));
    for (const t of seen) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const n = Math.max(opps.length, 1);
  const idf = new Map<string, number>();
  for (const [t, c] of df) idf.set(t, Math.log(1 + n / (1 + c)));
  return idf;
}

function oppText(o: RankableOpportunity): string {
  return [
    o.title,
    o.organization,
    o.category,
    o.eligibility,
    o.description,
    (o.tags ?? []).join(" "),
    (o.related_skills ?? []).join(" "),
  ]
    .filter(Boolean)
    .join(" ");
}

const GRADE_ORDER: Record<string, number> = {
  middle_school: 1,
  high_school: 2,
  undergraduate: 3,
  graduate: 4,
  career_change: 3,
};

   
                                                                               
                                                                                
                                        
   
export function obviouslyIneligible(o: RankableOpportunity, p: RankProfile): boolean {
  const text = `${o.eligibility ?? ""} ${o.title ?? ""}`.toLowerCase();
  const level = GRADE_ORDER[String(p.education_level ?? "")] ?? 0;
  if (!level) return false;

                 
  if (level <= 2 && /\b(graduate students?|phd|doctoral|postdoc|master'?s students?)\s+only\b/.test(text)) return true;
  if (level <= 2 && /\b(undergraduates?|college students?)\s+only\b/.test(text)) return true;
  if (level >= 3 && /\b(high school|middle school)\s+students?\s+only\b/.test(text)) return true;
  if (level === 1 && /\b(high school (juniors|seniors)|grades? 1[0-2])\b/.test(text) && !/middle school|grades? [6-8]/.test(text)) return true;

                                                                                    
  if (p.immigration_status_note && /\b(us citizens? only|must be a us citizen|citizenship required|permanent residents? only)\b/.test(text)) return true;

  return false;
}

   
                                                                         
                                                 
  
                                                                                          
                                                                                                    
  
                                                                              
                                                                              
                                                                             
                                  
   
export const IMMINENCE_WEIGHT = 8;
export const IMMINENCE_HALF_LIFE_DAYS = 5;
export const FRESHNESS_WEIGHT = 5;
export const FRESHNESS_HALF_LIFE_DAYS = 180;
export const PLANNING_HORIZON_DAYS = 120;

export function daysUntil(deadline: string | null | undefined, now = new Date()): number | null {
  return daysUntilDeadline(deadline, now);
}


   
                                                                              
   
export function preRankScore(
  o: RankableOpportunity,
  terms: Map<string, number>,
  idf: Map<string, number>,
  p: RankProfile,
  now = new Date(),
): number {
                                                                    
  const tokens = tokenize(oppText(o));
  const counts = new Map<string, number>();
  for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  let lexical = 0;
  for (const [term, weight] of terms) {
    const tf = counts.get(term);
    if (!tf) continue;
                                                                    
    lexical += weight * (idf.get(term) ?? 1) * (tf / (tf + 1.5));
  }
  const norm = 1 / Math.sqrt(Math.max(tokens.length, 30));
  let score = Math.min(55, lexical * norm * 12);

                                                                                
  const titleTokens = new Set(tokenize(`${o.title ?? ""} ${(o.tags ?? []).join(" ")}`));
  let titleHits = 0;
  for (const [term, weight] of terms) if (titleTokens.has(term)) titleHits += weight;
  score += Math.min(14, titleHits * 1.6);

                                                                           
  const lowIncome =
    p.needs_full_ride === true ||
    p.applying_with_financial_aid === true ||
    /(low[- ]?income|first[- ]?gen|pell|free.{0,8}lunch|underserved|need[- ]?based)/i.test(p.socioeconomic_info ?? "");

  if (lowIncome) {
    if (o.application_fee === 0) score += 6;
    else if (typeof o.application_fee === "number" && o.application_fee > 0) score -= 4;
    if (o.fee_waiver_available) score += 3;
    if (o.travel_required === false || /virtual|online|remote/i.test(o.format ?? "")) score += 4;
    if (o.travel_required === true) score -= 3;
    if (typeof o.value_usd === "number" && o.value_usd >= 10_000) score += 6;
    if (p.needs_full_ride && typeof o.value_usd === "number" && o.value_usd >= 40_000) score += 6;
    if (o.underrepresented) score += 4;
  }
  if (p.foster_youth_status && /foster|ward of the (state|court)|etv\b/i.test(oppText(o))) score += 12;
  if (p.housing_insecure_status && /homeless|housing insecur|mckinney|unaccompanied youth/i.test(oppText(o))) score += 12;
  if (p.immigration_status_note && /(undocumented|daca|dream(er)?s?\.?us|no citizenship requirement|regardless of (immigration )?status)/i.test(oppText(o))) score += 12;

  score += locationFit(placeFor(p), o).score;

                                
  const colleges = [...(p.dream_colleges ?? []), ...(p.target_colleges ?? [])].filter(Boolean);
  if (colleges.some((c) => oppText(o).toLowerCase().includes(String(c).toLowerCase()))) score += 8;

                                                                                 
                                                                          
                             
                                                                           
                                                                             
                                                                 
                                                                              
                                                                                  
                                                                             
                                           
  const days = daysUntil(o.deadline, now);
  if (days !== null) {
    score -= IMMINENCE_WEIGHT * Math.pow(2, -Math.max(days, 0) / IMMINENCE_HALF_LIFE_DAYS);
    const beyond = Math.max(0, days - PLANNING_HORIZON_DAYS);
    score += FRESHNESS_WEIGHT * Math.pow(2, -beyond / FRESHNESS_HALF_LIFE_DAYS);
  }


                                                                            
  if (/very high|extreme/i.test(o.competitiveness ?? "")) {
    const hasAwards = (p.certifications ?? []).length > 0;
    score += hasAwards ? 2 : -5;
  }

  return score;
}

                                                                     
export function profileDocument(p: RankProfile): string {
  return [
    p.intended_major,
    (p.career_interests ?? []).join(" "),
    (p.academic_interests ?? []).join(" "),
    p.long_term_goals,
    (p.skills ?? []).join(" "),
    (p.extracurriculars ?? []).join(" "),
    (p.certifications ?? []).join(" "),
    (p.dream_colleges ?? []).join(" "),
    (p.target_colleges ?? []).join(" "),
    p.socioeconomic_info,
    p.immigration_status_note,
    p.foster_youth_status ? "foster youth" : "",
    p.housing_insecure_status ? "housing insecure homeless" : "",
    p.needs_full_ride ? "full ride low income financial aid" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

                                                                                  
export const RRF_K = 60;
export function rrf(rank: number, k = RRF_K): number {
  return 1 / (k + rank + 1);
}

                                                     
function saturate(x: number, half: number): number {
  return x <= 0 ? 0 : x / (x + half);
}

export type ScoredOpportunity<T> = {
  opportunity: T;
  lexical: number;
  semantic: number;
  fused: number;
};

   
                    
  
                                                               
                                                                            
                                        
                                                                           
                                                                          
                                     
  
                                                           
                                                                              
                                                                              
                                                                               
                                                                              
                                                                 
  
                                                                       
                                                                               
                                                                
                                                                                 
                                                                           
                                                                              
   
export const LEXICAL_WEIGHT = 1.0;
export const SEMANTIC_WEIGHT = 0.9;
export const RRF_TIEBREAK_WEIGHT = 4;
                                                                                  
export const LEXICAL_HALF_CONFIDENCE = 15;

export function hybridRank<T extends RankableOpportunity>(
  opps: T[],
  profile: RankProfile,
  now = new Date(),
): ScoredOpportunity<T>[] {
  const candidates = opps.filter((o) => !obviouslyIneligible(o, profile));
  const idf = buildIdf(candidates);
  const terms = profileTerms(profile);
  const profileVec = embed(profileDocument(profile));

  const rows = candidates.map((o) => ({
    opportunity: o,
    lexical: preRankScore(o, terms, idf, profile, now),
    semantic: cosine(profileVec, embed(oppText(o))),
    fused: 0,
  }));
  if (rows.length === 0) return rows;

  const byLexical = [...rows].sort((a, b) => b.lexical - a.lexical);
  const bySemantic = [...rows].sort((a, b) => b.semantic - a.semantic);
  const lexRank = new Map(byLexical.map((r, i) => [r.opportunity.id, i]));
  const semRank = new Map(bySemantic.map((r, i) => [r.opportunity.id, i]));

                                                                        
                                                    
  const mean = rows.reduce((s, r) => s + r.semantic, 0) / rows.length;
  const variance = rows.reduce((s, r) => s + (r.semantic - mean) ** 2, 0) / rows.length;
  const sd = Math.sqrt(variance) || 1e-9;

  for (const r of rows) {
    const lexConfidence = saturate(r.lexical, LEXICAL_HALF_CONFIDENCE);
    const z = (r.semantic - mean) / sd;
    const semConfidence = 1 / (1 + Math.exp(-1.4 * z));                           
    r.fused =
      LEXICAL_WEIGHT * lexConfidence +
      SEMANTIC_WEIGHT * semConfidence +
      RRF_TIEBREAK_WEIGHT *
        (rrf(lexRank.get(r.opportunity.id)!) + rrf(semRank.get(r.opportunity.id)!));
  }
  return rows.sort((a, b) => b.fused - a.fused);
}


   
                                                                         
                                                                           
                                                                             
   
export function shortlistOpportunities<T extends RankableOpportunity>(
  opps: T[],
  profile: RankProfile,
  limit = 120,
  now = new Date(),
): T[] {
  const scored = hybridRank(opps, profile, now).map((r) => ({ o: r.opportunity }));


  const perCategoryCap = Math.max(8, Math.ceil(limit * 0.35));
  const used = new Map<string, number>();
  const picked: T[] = [];
  const overflow: T[] = [];

  for (const { o } of scored) {
    if (picked.length >= limit) break;
    const key = o.category ?? "other";
    const n = used.get(key) ?? 0;
    if (n >= perCategoryCap) {
      overflow.push(o);
      continue;
    }
    used.set(key, n + 1);
    picked.push(o);
  }
                                                       
  for (const o of overflow) {
    if (picked.length >= limit) break;
    picked.push(o);
  }
  return picked;
}
