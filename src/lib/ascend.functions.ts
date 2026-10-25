import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { containsProfanity, FAMILY_FRIENDLY_MESSAGE } from "@/lib/profanity";
import { sanitizeText } from "@/lib/validation";
import { shortlistOpportunities, hybridRank, type RankProfile } from "@/lib/matching";
import { dbCategoriesFor, normalizeCategory } from "@/lib/categories";
import { tablesToLists } from "@/lib/chat-format";
import { buildSchoolYearPlan, todayPacific } from "@/lib/dates";
import { logEvent, recordEvent, startTimer } from "@/lib/observability";


const MODEL = "default";

const STYLE_RULES = `STYLE RULES (STRICT, NON-NEGOTIABLE):
1. NEVER use em-dashes (\u2014) or en-dashes (\u2013) anywhere in your output. Use a period, comma, colon, semicolon, or parentheses instead. This applies to every field, including JSON string values returned via tool calls.
2. Always address the reader directly in the second person ("you", "your", "yours"). Never refer to the reader as "the user", "the student", "the applicant", "they", "he", or "she". Speak TO them, not ABOUT them.
3. Be warm and direct.`;

function scrubDashesDeep<T>(v: T): T {
  if (typeof v === "string") return v.replace(/\s*[\u2014\u2013]\s*/g, ", ") as unknown as T;
  if (Array.isArray(v)) return v.map(scrubDashesDeep) as unknown as T;
  if (v && typeof v === "object") {
    const o: any = {};
    for (const k of Object.keys(v as any)) o[k] = scrubDashesDeep((v as any)[k]);
    return o;
  }
  return v;
}

/** Errors worth retrying: transient network faults, rate limits, upstream 5xx. */
class RetryableAIError extends Error {
  retryAfterMs?: number;
  constructor(message: string, retryAfterMs?: number) {
    super(message);
    this.retryAfterMs = retryAfterMs;
  }
}

const AI_MAX_ATTEMPTS = 3;
const AI_TIMEOUT_MS = 45_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type AIProvider = {
  name: string;
  url: string;
  key: string;
  model: string;
  jsonMode: boolean;
};

function getAIProviders(): AIProvider[] {
  const providers: AIProvider[] = [];
  if (process.env.GROQ_API_KEY) {
    providers.push({
      name: "groq",
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
      jsonMode: true,
    });
  }
  if (process.env.OPENROUTER_API_KEY) {
    providers.push({
      name: "openrouter",
      url: "https://openrouter.ai/api/v1/chat/completions",
      key: process.env.OPENROUTER_API_KEY,
      model: process.env.OPENROUTER_MODEL || "openai/gpt-oss-120b:free",
      jsonMode: false,
    });
  }
  return providers;
}

async function callAIOnce(body: Record<string, unknown>, provider: AIProvider) {
  const msgs = Array.isArray((body as any).messages)
    ? (body as any).messages.map((m: any) => ({ ...m }))
    : [];
  const usesTools = Array.isArray((body as any).tools) && (body as any).tools.length > 0;
  if (usesTools) {
    const fn = (body as any).tools[0]?.function;
    const schema = JSON.stringify(fn?.parameters ?? {});
    const last = msgs[msgs.length - 1];
    if (last) {
      last.content = `${last.content}\n\nRespond with ONLY a single valid JSON object matching this JSON schema (no markdown, no explanation):\n${schema}`;
    }
  }
  const patched: Record<string, unknown> = {
    ...body,
    model: provider.model,
    messages: [{ role: "system", content: STYLE_RULES }, ...msgs],
  };
  if (usesTools && provider.jsonMode) patched.response_format = { type: "json_object" };
  if (provider.name === "groq" && provider.model.startsWith("openai/gpt-oss")) patched.reasoning_effort = "low";
  delete (patched as any).tools;
  delete (patched as any).tool_choice;
  const timeoutMs = Number((patched as any).timeoutMs) || AI_TIMEOUT_MS;
  delete (patched as any).timeoutMs;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(provider.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
      body: JSON.stringify(patched),
      signal: controller.signal,
    });
  } catch (e) {
    throw new RetryableAIError(`Matching service unreachable: ${(e as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    if (res.status === 429) {
      const seconds = Number(res.headers.get("retry-after"));
      const waitMs = Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, 20_000) : undefined;
      throw new RetryableAIError("Rate limited. Please wait a moment and try again.", waitMs);
    }
    const errBody = await res.text();
    logEvent("ai_call_failed", { stage: "http", provider: provider.name, status: res.status, reason: errBody.slice(0, 300) });
    if (res.status === 402 || res.status === 403) throw new Error("The matching service is temporarily unavailable. Please try again in a little while.");
    if (res.status >= 500) throw new RetryableAIError(`Matching service error ${res.status}: ${errBody.slice(0, 200)}`);
    throw new Error(`Matching service error ${res.status}: ${errBody.slice(0, 200)}`);
  }
  const json = await res.json();
  if (json?.choices) {
    for (const c of json.choices) {
      if (c?.message?.content) c.message.content = scrubDashesDeep(c.message.content);
    }
  }
  return json;
}

/**
 * Read the structured result of an AI call. Tool calls were converted to
 * plain JSON-in-text requests (see callAIOnce), so this accepts either a
 * real tool_calls payload or a JSON object in the message content.
 */
function parseAIToolJson(ai: any): any {
  const msg = ai?.choices?.[0]?.message;
  const toolArgs = msg?.tool_calls?.[0]?.function?.arguments;
  if (typeof toolArgs === "string" && toolArgs.trim()) return JSON.parse(toolArgs);
  let text = typeof msg?.content === "string" ? msg.content.trim() : "";
  if (!text) return {};
  // Strip markdown fences and any prose around the JSON object.
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return {};
  return JSON.parse(text.slice(start, end + 1));
}

async function callAI(rawBody: Record<string, unknown>) {
  const { preferProvider, ...body } = rawBody as Record<string, unknown> & { preferProvider?: string };
  const providers = getAIProviders();
  if (preferProvider) providers.sort((a, b) => Number(b.name === preferProvider) - Number(a.name === preferProvider));
  if (providers.length === 0) throw new Error("No AI provider configured. Set GROQ_API_KEY or OPENROUTER_API_KEY.");
  const done = startTimer();
  let lastError: unknown;
  for (const provider of providers) {
    for (let attempt = 1; attempt <= AI_MAX_ATTEMPTS; attempt++) {
      try {
        const json = await callAIOnce(body, provider);
        logEvent("ai_call", { ok: true, provider: provider.name, attempt, duration_ms: done() });
        return json;
      } catch (e) {
        lastError = e;
        if (!(e instanceof RetryableAIError) || attempt === AI_MAX_ATTEMPTS) break;
        const backoff = (e as RetryableAIError).retryAfterMs ?? 400 * 2 ** (attempt - 1) + Math.random() * 250;
        logEvent("ai_call_failed", { provider: provider.name, attempt, retrying: true, reason: (e as Error).message.slice(0, 120) });
        await sleep(backoff);
      }
    }
    logEvent("ai_call_failed", { provider: provider.name, stage: "provider_exhausted", reason: (lastError as Error)?.message?.slice(0, 160) });
  }
  logEvent("ai_call_failed", {
    ok: false,
    attempts: AI_MAX_ATTEMPTS,
    duration_ms: done(),
    reason: (lastError as Error)?.message?.slice(0, 160),
  });
  throw lastError instanceof Error ? lastError : new Error("Matching service failed");
}

/** Same call, but returns null instead of throwing, for batch work that degrades. */
async function callAIOrNull(body: Record<string, unknown>) {
  try {
    return await callAI(body);
  } catch (e) {
    logEvent("ai_call_failed", { stage: "batch", reason: (e as Error).message.slice(0, 160) });
    return null;
  }
}

const TRUTHFULNESS_RULES = `TRUTHFULNESS RULES (non-negotiable):
- Only state facts about the student that appear in USER PROFILE exactly as written. An age range is not an exact age. Never state or imply their exact age, grade, GPA, test scores, income, citizenship, awards, leadership roles, or experiences unless the profile lists them.
- If eligibility depends on a fact you do not have, say what is missing and ask one short question instead of assuming.
- Only name programs, deadlines, costs, funding amounts, URLs, and requirements that appear in the opportunity details above or that you are certain are real and current. If you are not certain, say so and tell the student to confirm on the official site. Never invent a program, dollar amount, deadline, or link.
- "Financial aid available" is not "free". Say aid may be available and must be applied for. Only call a program free if the details say there is no cost, and keep application fees, tuition, travel, and equipment separate.
- Never promise that a scholarship, waiver, or admission will be granted. Treat admissions and funding as conditional outcomes.
- For essays and application text, use ONLY achievements and details found in the profile. Where the student's own story is needed (a specific project, number, role, quote, or moment), write a clearly marked placeholder such as [describe one specific project you built] and ask the student to fill it in. Never invent achievements, quotes, numbers, or events.`;

function profileSummary(p: any): string {
  const parts: string[] = [];
  if (p.age_range) parts.push(`Age range: ${p.age_range} (exact age not provided)`);
  if (p.education_level) parts.push(`Education: ${p.education_level}`);
  if (p.location) parts.push(`Location: ${p.location}${p.country ? ", " + p.country : ""}`);
  if (p.academic_interests?.length) parts.push(`Academic interests: ${p.academic_interests.join(", ")}`);
  if (p.career_interests?.length) parts.push(`Career interests: ${p.career_interests.join(", ")}`);
  if (p.skills?.length) parts.push(`Skills: ${p.skills.join(", ")}`);
  if (p.extracurriculars?.length) parts.push(`Extracurriculars: ${p.extracurriculars.join(", ")}`);
  if (p.certifications?.length) parts.push(`Certifications & Awards: ${p.certifications.join(", ")}`);
  if (p.languages?.length) parts.push(`Languages: ${p.languages.join(", ")}`);
  if (p.professional_experience) parts.push(`Experience: ${p.professional_experience}`);
  if (p.socioeconomic_info) parts.push(`Socioeconomic context: ${p.socioeconomic_info}`);
  if (p.long_term_goals) parts.push(`Long-term goals: ${p.long_term_goals}`);
  if (p.intended_major) parts.push(`Intended college major: ${p.intended_major}`);
  if (p.college_application_year) parts.push(`College application year: ${p.college_application_year}`);
  if (p.dream_colleges?.length) parts.push(`Dream (reach) colleges: ${p.dream_colleges.join(", ")}`);
  if (p.target_colleges?.length) parts.push(`Target colleges: ${p.target_colleges.join(", ")}`);
  if (p.safety_colleges?.length) parts.push(`Safety colleges: ${p.safety_colleges.join(", ")}`);
  if (p.applying_with_financial_aid === true) parts.push(`Applying with financial aid: YES (need-based aid is required)`);
  else if (p.applying_with_financial_aid === false) parts.push(`Applying with financial aid: No`);
  if (p.foster_youth_status === true) parts.push(`Foster care experience: YES (self-reported, opt-in). Eligible for foster-youth tuition waivers, ETV funds, and foster-specific scholarships.`);
  if (p.housing_insecure_status === true) parts.push(`Housing insecure or experiencing homelessness: YES (self-reported, opt-in). Eligible for McKinney-Vento supports, unaccompanied-youth FAFSA determinations, and homeless-youth scholarships.`);
  if (p.immigration_status_note) parts.push(`Immigration context (self-reported, opt-in): ${p.immigration_status_note}`);
  if (p.needs_full_ride === true) parts.push(`Needs a FULL RIDE (100% cost-of-attendance) to enroll, prioritize full-ride scholarships, QuestBridge, Posse, Gates, Cooke, and institutional full-ride programs at the listed schools.`);

  else if (p.needs_full_ride === false) parts.push(`Needs a full ride: No`);
  if (p.college_notes) parts.push(`College search notes: ${p.college_notes}`);
  return parts.join("\n");
}


function detectIncomeTier(p: any): "low" | "middle" | "high" | "unknown" {
  const s = `${p?.socioeconomic_info ?? ""}`.toLowerCase();
  if (!s.trim()) return "unknown";
  if (/(low[- ]?income|first[- ]?gen|free.{0,8}(lunch|reduced)|pell|title\s?i|underserved|fafsa|need[- ]?based|financial(ly)? (struggling|hardship)|poverty|underrepresented|foster|single[- ]?parent|undocumented|refugee|homeless)/.test(s))
    return "low";
  if (/(high[- ]?income|upper[- ]?middle|affluent|private school|wealthy|well[- ]?off)/.test(s))
    return "high";
  if (/(middle[- ]?(class|income)|moderate income|average income)/.test(s)) return "middle";
  return "unknown";
}

/**
 * Generate matches for the current user across all opportunities.
 */
export const generateMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ rescoreAll: z.boolean().optional() }).optional().parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const runTimer = startTimer();

    const { data: profile, error: pErr } = await supabase
      .from("profiles").select("*").eq("id", userId).maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!profile) throw new Error("Profile not found. Complete onboarding first.");

    // Expired programs never match: a passed deadline is not an opportunity.
    const today = todayPacific();

    // Stage 1, RETRIEVAL. Pull the entire approved, live catalog (paged, because
    // it is well past a thousand rows) instead of an arbitrary first 300.
    const catalog: any[] = [];
    const pageSize = 1000;
    for (let page = 0; page < 8; page++) {
      const { data, error } = await supabase
        .from("opportunities").select("id,title,organization,category,description,eligibility,tags,related_skills,competitiveness,underrepresented,value_usd,application_fee,fee_waiver_available,travel_required,equipment_needed,format,deadline,location,remote")
        .eq("status", "approved")
        .or(`deadline.is.null,deadline.gte.${today}`)
        .order("id", { ascending: true })
        .range(page * pageSize, page * pageSize + pageSize - 1);
      if (error) throw new Error(error.message);
      if (!data?.length) break;
      catalog.push(...data);
      if (data.length < pageSize) break;
    }
    if (!catalog.length) return { matched: 0 };

    // Stage 2, PRE-RANK. Score every row locally, drop the impossible ones, and
    // keep a category-diversified shortlist small enough to read carefully.
    const { data: existing } = await supabase.from("matches").select("opportunity_id").eq("user_id", userId);
    const seen = new Set((existing ?? []).map((r) => r.opportunity_id as string));
    const fresh = catalog.filter((o) => !seen.has(o.id));
    const pool = data?.rescoreAll || seen.size === 0 || fresh.length < 25 ? catalog : fresh;
    const shortlistSize = data?.rescoreAll || seen.size === 0 ? 96 : 48;
    const opps = shortlistOpportunities(pool, profile as RankProfile, shortlistSize);

    const profileText = profileSummary(profile);
    const tier = detectIncomeTier(profile);

    const chunkSize = 24;
    const results: { opportunity_id: string; eligible?: boolean; score: number; reasoning: string }[] = [];

    // Stage 3, RERANK. The LLM reads the shortlist in batches of 20, three at a
    // time so we stay well inside provider rate limits while cutting wall time.
    const chunks: any[][] = [];
    for (let i = 0; i < opps.length; i += chunkSize) chunks.push(opps.slice(i, i + chunkSize));

    let failedChunks = 0;
    const scoreChunk = async (chunk: any[], chunkIndex: number) => {
      const oppList = chunk.map((o, idx) => {
        const fee = o.application_fee === 0 ? "free" : typeof o.application_fee === "number" ? `$${o.application_fee}` : "unknown";
        const travel = o.travel_required === true ? "yes" : o.travel_required === false ? "no" : "unknown";
        return `[${idx}] ${o.category} | ${o.title} (${o.organization})\n  Eligibility: ${String(o.eligibility ?? "").slice(0, 300)}\n  Tags: ${(o.tags ?? []).slice(0, 6).join(", ")} | Where: ${o.location ?? "n/a"} | Value: ${o.value_usd ? `$${o.value_usd}` : "n/a"} | Fee: ${fee}${o.fee_waiver_available ? " (waiver)" : ""} | Travel: ${travel} | Format: ${o.format ?? "unknown"}${o.underrepresented ? " | Underrepresented-friendly" : ""}${o.equipment_needed ? ` | Equipment: ${o.equipment_needed}` : ""}`;
      }).join("\n");

      const sys = `You are Ascend's personalization engine. For each numbered opportunity, decide HARD ELIGIBILITY, then a fit score, then whether it is a CURRENT match or a FUTURE recommendation. Call score_opportunities with one entry per opportunity, using its number as n.

HARD ELIGIBILITY. Set eligible=false if any stated requirement is not met by the profile: ethnicity or race, gender, income or Pell status, age range, grade or education level, citizenship or residency or location, disability, veteran, first-generation, LGBTQ+, religious or other identity restrictions, and required major or field when restrictive. If the profile is silent on a restricted identity requirement, treat the user as NOT eligible. Never assume race, gender, disability, veteran, LGBTQ+, or religious status.

OPT-IN FLAGS (foster care experience, housing insecurity, immigration context) follow the same policy as protected traits. If the profile is silent, treat the flag as absent. Use a set flag ONLY to add eligible opportunities, never to exclude or down-score anything, and never mention it as a weakness. Foster care: foster-youth tuition waivers, ETV funds, Foster Care to Success, Casey Family Programs, campus foster-youth programs. Housing insecurity: McKinney-Vento supports, unaccompanied homeless youth FAFSA, SchoolHouse Connection, emergency aid. Immigration context indicating no citizenship or permanent residency: funds open without citizenship (TheDream.US, Golden Door, Hispanic Scholarship Fund where applicable, state aid open to undocumented residents). Never recommend anything that requires US citizenship or a Social Security number for such users, and never restate immigration details; say only "programs that do not require citizenship".

COST: each item lists fee, travel, and format. For low income tiers prefer free, fee-waivable, and virtual programs, and say so when it is a real reason. Never treat unknown costs as free.

FUTURE RECOMMENDATIONS: set is_future_recommendation=true (with eligible=false, ready_in such as "when you start 11th grade", and a specific future_reason) ONLY when the user is ineligible for a time-based or skill-based reason they can overcome (grade level, coursework, age, a prerequisite). Never for immutable identity requirements (race, ethnicity, gender, citizenship, disability, veteran status, religion, first-gen).

SCORE 0-100 only if eligible or future. Weigh profile strength against competitiveness (do not inflate), relevance to interests, skills and goals, acceptance odds, and the income tier "${tier}" (unknown means it was not stated, so do not assume one). For low-income, first-gen, or underserved users boost need-based, fee-waived, fully funded, and mentorship programs. For middle-income users balance merit and need. For high-income users favor selective merit programs. Use the full range. Score 80 or above when the user is clearly eligible AND the program fits their interests, awards, college goals, or finances. Aim for 25 to 40 such matches across the whole catalog. Keep scores below 80 for thin or speculative fits, and never inflate an ineligible program.

COLLEGE GOALS: if dream, target, or safety colleges are listed, favor institutional aid, fly-in, admitted-student, feeder, and partner programs for those schools (QuestBridge, Posse, MITES, SSP, HSSP, RSI) and name the school. If "Needs a FULL RIDE" is YES, favor full-ride scholarships and down-weight merit awards under $5k. If "Applying with financial aid" is YES, cite need-based alignment (CSS Profile, FAFSA, need-blind schools, fee waivers). Weight the intended major, and treat major-restricted programs in unrelated fields as low fit.

REASONING: write it only when eligible or future AND the score is 70 or higher; otherwise return an empty string. Use 1 to 2 specific sentences, at most 45 words. Map the program's actual screening criterion to the matching profile element and cite at least two of: a named interest, a named award or certification, socioeconomic context, a named skill or activity. Need-based programs (Pell, FAFSA aid, fee waivers, SNAP): cite financial context ONLY. Merit programs: cite the specific award. Hybrid programs: cite both. Identity-restricted programs: lead with the demographic match. Location or field restricted programs: lead with that match. Never write generic phrases like "your strong background".`;
      const user = `USER PROFILE:\n${profileText}\n\nOPPORTUNITIES (use each number as n):\n${oppList}`;

      const ai = await callAIOrNull({
        model: MODEL,
        max_tokens: 4500,
        preferProvider: chunkIndex % 2 === 0 ? "groq" : "openrouter",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        tools: [{
          type: "function",
          function: {
            name: "score_opportunities",
            description: "Return eligibility, scores, and reasoning for each opportunity.",
            parameters: {
              type: "object",
              properties: {
                scores: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      n: { type: "integer" },
                      eligible: { type: "boolean" },
                      is_future_recommendation: { type: "boolean" },
                      future_reason: { type: "string" },
                      ready_in: { type: "string" },
                      score: { type: "integer", minimum: 0, maximum: 100 },
                      reasoning: { type: "string" },
                    },
                    required: ["n", "eligible", "score", "reasoning"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["scores"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "score_opportunities" } },
      });


      // One bad batch must not take down the whole feed. A failed chunk is
      // counted, logged, and left to the local fallback below.
      if (!ai) {
        failedChunks++;
        return;
      }
      try {
        const args = parseAIToolJson(ai);
        if (Array.isArray(args.scores)) {
          for (const sc of args.scores) {
            const target = chunk[Number(sc?.n)];
            if (target) results.push({ ...sc, opportunity_id: target.id });
          }
        }
        else failedChunks++;
      } catch (e) {
        failedChunks++;
        logEvent("ai_call_failed", { stage: "parse", reason: (e as Error).message.slice(0, 120) });
      }
    };

    const concurrency = 2;
    for (let i = 0; i < chunks.length; i += concurrency) {
      await Promise.all(chunks.slice(i, i + concurrency).map((c, j) => scoreChunk(c, i + j)));
    }

    /**
     * GRACEFUL DEGRADATION.
     *
     * If the model was unreachable for every batch, the honest options are an
     * error page or the local ranking. Stage 1 already computed a real, fully
     * offline score for each program, so the feed falls back to it: the student
     * still gets ranked, eligibility-filtered opportunities, just without the
     * written "why you" paragraph. The app does not go dark because an API did.
     */
    let degraded = false;
    if (results.length === 0 && chunks.length > 0) {
      degraded = true;
      const localRanked = hybridRank(opps as any, profile as RankProfile);
      const top = localRanked.slice(0, 25);
      const best = top[0]?.fused ?? 1;
      for (const r of top) {
        results.push({
          opportunity_id: r.opportunity.id,
          eligible: true,
          // Unverified local scores are capped at 79 so they show as "close
          // matches" and never claim the verified 80+ band. Ordering is kept.
          score: Math.round(70 + 9 * (best > 0 ? Math.min(1, r.fused / best) : 0)),
          reasoning:
            "Matched on your profile by Ascend's on-device ranking while the personalized write-up is temporarily unavailable. Refresh your feed later to see the full explanation.",
        });
      }
    }

    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validIds = new Set(opps.map((o: any) => o.id));
    const valid = results.filter(
      (r: any) => r && typeof r.opportunity_id === "string" && uuidRe.test(r.opportunity_id) && validIds.has(r.opportunity_id),
    );
    const eligible = valid.filter((r: any) => r.eligible !== false);
    const future = valid.filter((r: any) => r.eligible === false && r.is_future_recommendation === true);
    const drop = valid.filter((r: any) => r.eligible === false && r.is_future_recommendation !== true).map((r: any) => r.opportunity_id);

    const rows = [
      ...eligible.map((r: any) => ({
        user_id: userId,
        opportunity_id: r.opportunity_id,
        score: Math.max(0, Math.min(100, Math.round(Number(r.score) || 0))),
        reasoning: String(r.reasoning ?? "").slice(0, 2000),
        is_future: false,
        future_reason: null as string | null,
        ready_in: null as string | null,
        generated_at: new Date().toISOString(),
      })),
      ...future.map((r: any) => ({
        user_id: userId,
        opportunity_id: r.opportunity_id,
        score: Math.max(0, Math.min(100, Math.round(Number(r.score) || 0))),
        reasoning: String(r.reasoning ?? "").slice(0, 2000),
        is_future: true,
        future_reason: r.future_reason ? String(r.future_reason).slice(0, 500) : null,
        ready_in: r.ready_in ? String(r.ready_in).slice(0, 100) : null,
        generated_at: new Date().toISOString(),
      })),
    ];

    const byId = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      const prev = byId.get(row.opportunity_id);
      const better = !prev || (prev.is_future && !row.is_future) || (prev.is_future === row.is_future && row.score > prev.score);
      if (better) byId.set(row.opportunity_id, row);
    }
    const dedupedRows = [...byId.values()];

    if (dedupedRows.length) {
      const { error: upErr } = await supabase.from("matches").upsert(dedupedRows, { onConflict: "user_id,opportunity_id" });
      if (upErr) throw new Error(upErr.message);
    }
    // Expire matches older than 30 days so closed or changed programs drop off.
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("matches").delete().eq("user_id", userId).lt("generated_at", cutoff);

    // Remove previously-stored matches the user is not eligible for and not a future recommendation.
    const dropIds = [...new Set(drop)].filter((id) => !byId.has(id));
    if (dropIds.length) {
      await supabase.from("matches").delete().eq("user_id", userId).in("opportunity_id", dropIds);
    }

    await recordEvent(supabase, "match_generation", {
      duration_ms: runTimer(),
      ok: !degraded,
      catalog: catalog.length,
      shortlisted: opps.length,
      chunks: chunks.length,
      failed_chunks: failedChunks,
      matched: dedupedRows.filter((r) => !r.is_future).length,
      future: dedupedRows.filter((r) => r.is_future).length,
      degraded,
    });

    return {
      matched: dedupedRows.filter((r) => !r.is_future).length,
      future: dedupedRows.filter((r) => r.is_future).length,
      degraded,
    };
  });


/**
 * Application assistant - non-streaming chat.
 */
export const assistantChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    opportunityId: z.string().uuid(),
    messages: z.array(z.object({
      role: z.enum(["user", "assistant"]),
      content: z.preprocess(sanitizeText, z.string().min(1).max(8000)),
    })).min(1).max(40),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const lastUser = [...data.messages].reverse().find((m) => m.role === "user");
    if (lastUser && containsProfanity(lastUser.content)) {
      return { content: `${FAMILY_FRIENDLY_MESSAGE} Let's focus on your application, deadlines, or essays.` };
    }

    const [{ data: profile }, { data: opp }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("opportunities").select("*").eq("id", data.opportunityId).maybeSingle(),
    ]);
    if (!opp) throw new Error("Opportunity not found");

    const sys = `You are the Ascend Assistant. Be concise, structured, and actionable. Use markdown headings, bold, and bullet lists. Never use markdown tables or pipe characters; present comparisons as bullet lists. Calculate timelines from today and the deadline. Ground essay drafts in the user's profile. Be honest about eligibility gaps and how to close them.

${TRUTHFULNESS_RULES}

OPPORTUNITY:
Title: ${opp.title}
Organization: ${opp.organization}
Category: ${opp.category}
Description: ${opp.description}
Eligibility: ${opp.eligibility}
Deadline: ${opp.deadline ?? "not listed on the source page"}
Value: ${opp.value_usd ? `$${opp.value_usd}` : "varies"}
URL: ${opp.url ?? "n/a"}

USER PROFILE:
${profile ? profileSummary(profile) : "(not yet completed)"}

Today is ${todayPacific()}.`;

    const ai = await callAI({
      model: MODEL,
      messages: [{ role: "system", content: sys }, ...data.messages],
    });
    const content = tablesToLists(ai.choices?.[0]?.message?.content ?? "I couldn't generate a response. Please try again.");
    return { content };
  });

/**
 * Ascend Coach - general Q&A chat about opportunities, applications, careers, college, financial aid, etc.
 */
export const coachChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    messages: z.array(z.object({
      role: z.enum(["user", "assistant"]),
      content: z.preprocess(sanitizeText, z.string().min(1).max(8000)),
    })).min(1).max(50),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Family-friendly guard: intercept vulgar user messages before hitting the model.
    const lastUser = [...data.messages].reverse().find((m) => m.role === "user");
    if (lastUser && containsProfanity(lastUser.content)) {
      return { content: `${FAMILY_FRIENDLY_MESSAGE} I'm here to help with scholarships, school, careers, and financial aid whenever you're ready.` };
    }
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    const tier = profile ? detectIncomeTier(profile) : "unknown";

    const sys = `You are the Ascend Coach, a warm, encouraging mentor for middle and high school students (ages 11-18), many of whom are first-generation, low-income, or underserved. Your tone is supportive, patient, and pedagogical, like a favorite teacher who genuinely believes in you.

TONE AND ACCESSIBILITY RULES (non-negotiable, youth-centric):
- Write at roughly a 7th to 9th grade reading level. Short sentences. Plain words.
- Avoid dense academic or financial jargon. When a technical term is necessary (FAFSA, EFC, subsidized vs. unsubsidized loan, EITC, 1098-T, EOP, Pell, SAR, CSS Profile), define it in ONE plain-language sentence the first time it appears, then use it. Example: "Subsidized loans are loans where the government pays the interest for you while you are in school. Unsubsidized loans charge interest the whole time, so they cost more over the years."
- Use analogies a teenager understands (subscriptions, video games, sports teams, group projects).
- Be encouraging, never condescending. Celebrate small wins. Never imply a question is dumb.
- Bold key vocabulary words with **markdown** so they stand out.
- Use short bulleted steps and numbered checklists, not long paragraphs.
- Never use markdown tables or pipe characters. Present schedules and comparisons as bullet lists, for example "- **Monday:** review a geometry theorem".
- End answers with a small "Next step you can take this week" line whenever it fits.

You answer ANY question a student, jobseeker, or learner might ask about discovering and winning opportunities: scholarships, grants, internships, competitions, mentorships, jobs, research programs, government benefits (FAFSA, Pell, SNAP, EITC), tax credits, community resources, and entrepreneurial funding. Be concrete, specific, and actionable. Quote dollar amounts, deadlines, and eligibility honestly. When the user lacks money for high-cost programs, lead with free / need-based alternatives. When the user is privileged, suggest stretch goals worthy of their profile.

PERSONALIZATION RULES (non-negotiable):
- Every recommendation MUST be grounded in a specific element of the user's profile: their field of interest, achievements, location, education level, languages, or socioeconomic context. Cite the element in-line.
- When recommending programs (summer programs, internships, scholarships, etc.) name SPECIFIC, real programs that fit the profile, not generic categories. Example: instead of "look at summer biology programs", say "Given your USABO Semifinalist standing and interest in neuroscience, look at the Simons Summer Research Program at Stony Brook, the Garcia Program at Stony Brook, and Boston University's RISE Internship."
- If the profile is thin in the relevant area, ask ONE targeted question to fill the gap, then recommend.
- Never give a generic listicle. Every bullet should reference a profile-specific reason.

${TRUTHFULNESS_RULES}

Ground every answer in the user's profile when relevant. Income tier: "${tier}". If it is "unknown", the student has not said, so never state or assume their income; ask, or give advice that works for any budget. Otherwise tailor financial-aid advice without being condescending.

USER PROFILE:
${profile ? profileSummary(profile) : "(profile incomplete, gently encourage finishing onboarding when relevant)"}

Today is ${todayPacific()}.`;

    const ai = await callAI({
      model: MODEL,
      messages: [{ role: "system", content: sys }, ...data.messages],
    });
    const content = tablesToLists(ai.choices?.[0]?.message?.content ?? "I couldn't generate a response. Please try again.");
    return { content };
  });

/**
 * Discover live opportunities from the web (Firecrawl + AI extraction), then ingest + re-match.
 */
export const discoverOpportunities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      focus: z.enum(["auto", "summer", "internship", "research", "tutoring", "volunteer", "scholarship", "low_income"]).default("auto"),
    }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) throw new Error("Firecrawl is not connected.");

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!profile) throw new Error("Complete onboarding first.");

    // Rate limit: each run fans out to several web searches plus an extraction call.
    const COOLDOWN_MS = 10 * 60 * 1000;
    const last = (profile as { last_discovered_at?: string | null }).last_discovered_at;
    if (last) {
      const elapsed = Date.now() - new Date(last).getTime();
      if (elapsed < COOLDOWN_MS) {
        const mins = Math.max(1, Math.ceil((COOLDOWN_MS - elapsed) / 60000));
        throw new Error(`You just ran a live search. Try again in about ${mins} minute${mins === 1 ? "" : "s"}.`);
      }
    }
    await supabase.from("profiles").update({ last_discovered_at: new Date().toISOString() }).eq("id", userId);

    const tier = detectIncomeTier(profile);

    const interests = [
      ...(profile.academic_interests ?? []),
      ...(profile.career_interests ?? []),
    ].slice(0, 4).join(", ") || "general";
    const grade = profile.education_level ?? "student";
    const loc = profile.location ?? "United States";

    const focusMap: Record<string, string[]> = {
      auto: [
        `summer programs ${grade} ${interests} 2026 application`,
        `paid internships ${interests} ${loc} students apply`,
        `undergraduate research opportunities ${interests} ${loc}`,
        `${tier === "low" ? "free fully funded" : ""} scholarships ${interests} ${grade}`.trim(),
      ],
      summer: [`summer programs ${grade} ${interests} 2026 application deadline`],
      internship: [`paid internships ${interests} ${loc} ${grade} apply 2026`],
      research: [`undergraduate research program ${interests} ${loc} application`],
      tutoring: [`free tutoring program ${grade} ${interests} ${loc}`],
      volunteer: [`volunteer opportunities ${interests} ${loc} students`],
      scholarship: [`${tier === "low" ? "need-based first-generation" : ""} scholarships ${interests} ${grade} apply`.trim()],
      low_income: [
        `free fully funded summer program low-income first-generation ${grade}`,
        `need-based scholarships first-generation students ${interests}`,
        `pell grant eligible programs ${grade} ${interests}`,
      ],
    };
    const queries = focusMap[data.focus];

    const { default: Firecrawl } = await import("@mendable/firecrawl-js");
    const firecrawl = new Firecrawl({ apiKey });

    const searchResults: { url: string; title: string; description?: string; markdown?: string }[] = [];
    for (const q of queries) {
      try {
        const res: any = await firecrawl.search(q, {
          limit: 5,
          scrapeOptions: { formats: ["markdown"] },
        });
        const items = res?.web ?? res?.data ?? [];
        for (const it of items) {
          if (it?.url) {
            searchResults.push({
              url: it.url,
              title: it.title ?? "",
              description: it.description ?? "",
              markdown: (it.markdown ?? "").slice(0, 6000),
            });
          }
        }
      } catch (e) {
        console.error("firecrawl search error", q, e);
      }
    }

    if (!searchResults.length) {
      return { discovered: 0, message: "No web results. Try again in a moment." };
    }

    // Deduplicate by URL and check what we already have
    const seen = new Set<string>();
    const unique = searchResults.filter((r) => {
      if (!r.url || seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });

    const { data: existing } = await supabase
      .from("opportunities")
      .select("url")
      .in("url", unique.map((u) => u.url));
    const existingUrls = new Set((existing ?? []).map((e: any) => e.url).filter(Boolean));
    const fresh = unique.filter((u) => !existingUrls.has(u.url));

    if (!fresh.length) {
      return { discovered: 0, message: "Already in your library, refreshing matches." };
    }

    // Use AI to structure the scraped results into opportunity rows.
    const sys = `Extract real opportunities (scholarships, internships, summer programs, research, tutoring, volunteer work, grants, competitions, mentorships, jobs) from the provided web search snippets. Return only legitimate, currently-open opportunities you can clearly identify. Skip aggregator landing pages, blog roundups, and broken results. Be conservative, quality over quantity.`;
    const userMsg = `Extract opportunities. For each: title, organization, one-paragraph description, who qualifies, a category from [scholarship, grant, internship, competition, mentorship, job, research, government_benefit, tax_credit, community_resource, entrepreneurial, summer_program, volunteer, tutoring], approximate dollar value if mentioned (number only, no currency), whether it's friendly to underrepresented / low-income students, and 3-6 short tags.

ALSO extract the real cost of applying, ONLY when the source page states it. Never guess, never infer, and omit the field entirely when the page does not say:
- application_fee: the dollar cost to apply (use 0 when the page says free to apply / no application fee)
- fee_waiver_available: true only when a fee waiver is explicitly offered
- travel_required: true when attendance or travel to a physical site is required, false when it is stated as fully remote or virtual
- equipment_needed: a short phrase for required hardware, software, or materials (for example "laptop and reliable internet")
- format: one of virtual, in_person, hybrid

SOURCES:
${fresh.map((r, i) => `[${i}] ${r.url}\nTitle: ${r.title}\nDesc: ${r.description}\nContent: ${r.markdown?.slice(0, 2500) ?? ""}`).join("\n\n---\n\n")}`;

    const ai = await callAI({
      model: MODEL,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: userMsg },
      ],
      tools: [{
        type: "function",
        function: {
          name: "save_opportunities",
          description: "Save extracted opportunities",
          parameters: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    source_index: { type: "integer" },
                    title: { type: "string" },
                    organization: { type: "string" },
                    description: { type: "string" },
                    eligibility: { type: "string" },
                    category: { type: "string" },
                    value_usd: { type: "number" },
                    underrepresented: { type: "boolean" },
                    tags: { type: "array", items: { type: "string" } },
                    application_fee: { type: "number" },
                    fee_waiver_available: { type: "boolean" },
                    travel_required: { type: "boolean" },
                    equipment_needed: { type: "string" },
                    format: { type: "string", enum: ["virtual", "in_person", "hybrid"] },
                  },
                  required: ["source_index", "title", "organization", "description", "eligibility", "category"],
                  additionalProperties: false,
                },
              },
            },
            required: ["items"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "save_opportunities" } },
    });

    let items: any[] = [];
    try {
      const args = parseAIToolJson(ai);
      if (Array.isArray(args.items)) items = args.items;
    } catch (e) {
      console.error("extract parse", e);
    }

    if (!items.length) return { discovered: 0, message: "No structured opportunities extracted." };

    const rows = items
      .map((it) => {
        const src = fresh[it.source_index];
        if (!src) return null;
        return {
          title: String(it.title).slice(0, 300),
          organization: String(it.organization).slice(0, 200),
          description: String(it.description).slice(0, 2000),
          eligibility: String(it.eligibility).slice(0, 1000),
          category: String(it.category).slice(0, 50),
          value_usd: typeof it.value_usd === "number" && isFinite(it.value_usd) ? Math.max(0, Math.round(it.value_usd)) : null,
          underrepresented: !!it.underrepresented,
          tags: Array.isArray(it.tags) ? it.tags.slice(0, 10).map((t: any) => String(t).slice(0, 50)) : [],
          url: src.url,
          remote: it.format === "virtual",
          // Cost fields default to null (unknown) rather than a guess.
          application_fee: typeof it.application_fee === "number" && isFinite(it.application_fee)
            ? Math.max(0, Math.round(it.application_fee)) : null,
          fee_waiver_available: typeof it.fee_waiver_available === "boolean" ? it.fee_waiver_available : null,
          travel_required: typeof it.travel_required === "boolean" ? it.travel_required : null,
          equipment_needed: typeof it.equipment_needed === "string" && it.equipment_needed.trim()
            ? it.equipment_needed.trim().slice(0, 300) : null,
          format: ["virtual", "in_person", "hybrid"].includes(it.format) ? it.format : null,
          status: "pending",
        };
      })
      .filter(Boolean) as any[];

    if (rows.length) {
      const { error: insErr } = await supabase.from("opportunities").insert(rows);
      if (insErr) console.error("insert opps", insErr);
    }

    return { discovered: rows.length, pendingReview: rows.length };
  });

/**
 * Acceptance Probability Engine, estimates likelihood of acceptance with reasoning + action plan.
 */
export const acceptanceAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ opportunityId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: opp }, { data: match }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("opportunities").select("*").eq("id", data.opportunityId).maybeSingle(),
      supabase.from("matches").select("score,reasoning").eq("user_id", userId).eq("opportunity_id", data.opportunityId).maybeSingle(),
    ]);
    if (!opp) throw new Error("Opportunity not found");
    if (!profile) throw new Error("Complete onboarding first");

    // Profile completeness signal
    const fields = ["age_range","education_level","location","academic_interests","career_interests","skills","extracurriculars","certifications","languages","professional_experience","socioeconomic_info","long_term_goals","intended_major","dream_colleges","target_colleges","college_application_year"] as const;
    const filled = fields.filter((f) => {
      const v = (profile as any)[f];
      return Array.isArray(v) ? v.length > 0 : !!v;
    }).length;
    const completeness = Math.round((filled / fields.length) * 100);

    const tier = detectIncomeTier(profile);
    const sys = `You are Ascend's Acceptance Probability Engine. Estimate the realistic probability (0-100) that THIS user is accepted to THIS opportunity. Combine: eligibility fit, profile depth vs. competitiveness, demographic alignment, experience overlap, deadline pressure, and historical norms for similar programs. Be honest, do not inflate. Then produce strengths, weaknesses, and an Action Plan: 3-6 concrete steps the user can take to raise their probability, with an estimated new probability after completing them. Confidence reflects how much signal you had from the profile (low/medium/high). The probability is an approximate estimate, not official admissions data. Profile completeness: ${completeness}%. Match score (if available): ${match?.score ?? "n/a"}. User income tier: ${tier}.

READINESS CHECKLIST: also list 4 to 8 specific requirements taken from the opportunity's eligibility and description (grade level, age, residency, GPA, documents, essays, recommendations, test scores, fees). For each, set status to "met" ONLY if the profile states it, "not_met" ONLY if the profile clearly contradicts it, and "unknown" if the profile is silent. Never guess. Add a note of at most 25 words naming the profile fact that supports the status, or the exact information that is missing. Then list up to 5 short questions in missing_info whose answers would make the estimate more reliable.

${TRUTHFULNESS_RULES}`;

    const userMsg = `OPPORTUNITY:
${opp.title}, ${opp.organization} (${opp.category})
Description: ${opp.description}
Eligibility: ${opp.eligibility}
Competitiveness: ${opp.competitiveness ?? "unknown"}
Deadline: ${opp.deadline ?? "rolling"}
Value: ${opp.value_usd ? `$${opp.value_usd}` : "varies"}
Underrepresented-friendly: ${opp.underrepresented}

USER PROFILE:
${profileSummary(profile)}`;

    const ai = await callAI({
      model: MODEL,
      messages: [{ role: "system", content: sys }, { role: "user", content: userMsg }],
      tools: [{
        type: "function",
        function: {
          name: "acceptance_analysis",
          description: "Return acceptance probability analysis",
          parameters: {
            type: "object",
            properties: {
              probability: { type: "integer", minimum: 0, maximum: 100 },
              potential_probability: { type: "integer", minimum: 0, maximum: 100 },
              confidence: { type: "string", enum: ["low","medium","high"] },
              strengths: { type: "array", items: { type: "string" } },
              weaknesses: { type: "array", items: { type: "string" } },
              action_plan: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    action: { type: "string" },
                    impact: { type: "string" },
                  },
                  required: ["action","impact"],
                  additionalProperties: false,
                },
              },
              summary: { type: "string" },
              readiness: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    requirement: { type: "string" },
                    status: { type: "string", enum: ["met", "not_met", "unknown"] },
                    note: { type: "string" },
                  },
                  required: ["requirement", "status", "note"],
                  additionalProperties: false,
                },
              },
              missing_info: { type: "array", items: { type: "string" } },
            },
            required: ["probability","potential_probability","confidence","strengths","weaknesses","action_plan","summary","readiness","missing_info"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "acceptance_analysis" } },
    });

    let parsed: any = {};
    try { parsed = parseAIToolJson(ai); } catch {}
    return {
      probability: Math.max(0, Math.min(100, Number(parsed.probability) || 0)),
      potential_probability: Math.max(0, Math.min(100, Number(parsed.potential_probability) || 0)),
      confidence: (parsed.confidence as "low"|"medium"|"high") ?? "medium",
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 8).map(String) : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.slice(0, 8).map(String) : [],
      action_plan: Array.isArray(parsed.action_plan) ? parsed.action_plan.slice(0, 8) : [],
      summary: String(parsed.summary ?? ""),
      readiness: (Array.isArray(parsed.readiness) ? parsed.readiness : [])
        .slice(0, 10)
        .map((r: any) => ({
          requirement: String(r?.requirement ?? ""),
          status: ["met", "not_met", "unknown"].includes(r?.status) ? (r.status as "met" | "not_met" | "unknown") : "unknown",
          note: String(r?.note ?? ""),
        }))
        .filter((r: { requirement: string }) => r.requirement),
      missing_info: Array.isArray(parsed.missing_info) ? parsed.missing_info.slice(0, 5).map(String) : [],
      completeness,
      match_score: match?.score ?? null,
    };
  });

/**
 * Life Path Simulator, generates 2-3 alternate pathways with milestones linked to real opportunities.
 */
export function createFallbackLifePaths(goal: string, field: string, years: number) {
  const steps = Array.from({ length: years }, (_, index) => {
    const year = index + 1;
    const progress = year / years;
    if (year === 1) {
      return {
        year,
        title: `Build your ${field} foundation`,
        description: `Choose strong classes, meet a teacher who can guide you, and begin one small project connected to ${goal}.`,
        skills: ["Study habits", "Curiosity", "Communication"],
        resources: ["School counselor", "Local library", "Ascend opportunity feed"],
        opportunity_ids: [],
      };
    }
    if (progress < 0.75) {
      return {
        year,
        title: `Turn interest into experience`,
        description: `Use your growing ${field} skills in a summer program, research project, competition, or community role. Keep a record of what you learn.`,
        skills: ["Project work", "Teamwork", "Writing"],
        resources: ["Ascend matched programs", "Teachers and mentors"],
        opportunity_ids: [],
      };
    }
    return {
      year,
      title: `Prepare your next step toward ${goal}`,
      description: `Strengthen your applications, ask for recommendations early, and compare education routes by cost, support, and fit.`,
      skills: ["Application planning", "Self advocacy", "Decision making"],
      resources: ["Ascend application tracker", "Counselor report"],
      opportunity_ids: [],
    };
  });

  return {
    explanation: "This starter path is based on your goal and time horizon. It stays available even when live planning is busy, so you can keep exploring and refine it later.",
    paths: [{
      name: `${goal} foundation path`,
      summary: `A practical ${years}-year route that builds knowledge, real experience, and a strong next-step plan in ${field}.`,
      education_required: "Varies by the specific role and pathway",
      skills: ["Academic foundations", "Applied experience", "Communication", "Planning"],
      milestones: steps,
    }],
  };
}

const LIFE_MILESTONE_ITEM_SCHEMA = {
  type: "object",
  properties: {
    year: { type: "integer" },
    title: { type: "string", description: "Unique title naming the main concrete thing that year" },
    description: { type: "string", description: "60-90 words on what the year looks like in practice" },
    why_you: { type: "string", description: "30-50 words citing specific profile details" },
    action_steps: { type: "array", items: { type: "string" }, description: "4-5 concrete steps, each with a month or season, a quantity, and a named thing" },
    targets: { type: "array", items: { type: "string" }, description: "3-5 named real programs, competitions, scholarships, courses, or colleges to target, each as Name: why it fits and when" },
    checkpoint: { type: "string", description: "One measurable sentence for the end of the year" },
    skills: { type: "array", items: { type: "string" } },
    opportunity_ids: { type: "array", items: { type: "string" } },
    resources: { type: "array", items: { type: "string" } },
  },
  required: ["year", "title", "description", "why_you", "action_steps", "targets", "checkpoint", "skills"],
  additionalProperties: false,
};

export const lifePathSimulate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => {
    const parsed = z.object({
      career_goal: z.preprocess(sanitizeText, z.string().min(1).max(200)),
      field: z.preprocess(sanitizeText, z.string().min(1).max(200)),
      education_level: z.preprocess(sanitizeText, z.string().min(1).max(100)),
      years: z.number().int().min(1).max(10),
    }).parse(input);

    // Guardrails against gibberish (judges love to break inputs).
    const looksRealText = (s: string) => {
      const t = s.trim();
      if (t.length < 2) return false;
      if (!/[aeiouy]/i.test(t)) return false;                 // must contain a vowel
      if (!/^[\p{L}\p{M}0-9 ,.&'/+\-()]+$/u.test(t)) return false; // only letters/common punct
      if (/(.)\1{3,}/.test(t)) return false;                  // no "aaaa" runs
      // reject single token of >=5 consonant-heavy chars with no recognizable word shape
      const tokens = t.split(/\s+/);
      const bad = tokens.some(tok => tok.length >= 5 && (tok.match(/[aeiouy]/gi)?.length ?? 0) / tok.length < 0.15);
      if (bad) return false;
      return true;
    };
    if (!looksRealText(parsed.career_goal)) {
      throw new Error("That career goal doesn't look quite right. Try something like Physician, Software Engineer, Teacher, Nurse, or Mechanical Engineer.");
    }
    if (!looksRealText(parsed.field)) {
      throw new Error("That field of study doesn't look quite right. Try something like Biology, Computer Science, Business, or Education.");
    }
    return parsed;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    const [{ data: myMatches }, { data: tracked }, { data: fieldOpps }] = await Promise.all([
      supabase
        .from("matches")
        .select("score,why_qualify,is_future,opportunities(id,title,organization,category,deadline,value_usd,eligibility,remote,location)")
        .eq("user_id", userId)
        .order("score", { ascending: false })
        .limit(30),
      supabase
        .from("user_opportunities")
        .select("status,opportunities(id,title,organization,category)")
        .eq("user_id", userId)
        .limit(40),
      supabase
        .from("opportunities")
        .select("id,title,organization,category,deadline,value_usd,eligibility")
        .or(`title.ilike.%${data.field.split(/[ /]/)[0].replace(/[%,()]/g, "")}%,description.ilike.%${data.career_goal.split(" ")[0].replace(/[%,()]/g, "")}%`)
        .limit(20),
    ]);

    const fmtOpp = (o: any, extra = "") =>
      `${o.id} | ${o.category} | ${o.title} (${o.organization}) | deadline=${o.deadline ?? "not listed"}${o.value_usd ? ` | award=$${o.value_usd}` : ""}${extra}`;
    const seen = new Set<string>();
    const lines: string[] = [];
    const titles: Record<string, string> = {};
    for (const m of (myMatches ?? []) as any[]) {
      const o = m.opportunities; if (!o || seen.has(o.id)) continue;
      seen.add(o.id); titles[o.id] = o.title;
      lines.push(fmtOpp(o, ` | match=${m.score}${m.is_future ? " (future: not eligible yet)" : ""}${m.why_qualify ? ` | why=${String(m.why_qualify).slice(0, 100)}` : ""}`));
    }
    for (const o of (fieldOpps ?? []) as any[]) {
      if (seen.has(o.id)) continue; seen.add(o.id); titles[o.id] = o.title; lines.push(fmtOpp(o, " | field-related"));
    }
    const trackerLines = ((tracked ?? []) as any[])
      .filter((t) => t.opportunities)
      .map((t) => `${t.status.toUpperCase()}: ${t.opportunities.title} (${t.opportunities.organization})`)
      .join("\n");
    const oppCatalog = lines.join("\n");
    const today = todayPacific();
    const plan = buildSchoolYearPlan({
      today,
      years: data.years,
      eduLevel: data.education_level,
      applicationText: (profile as any)?.college_application_year,
      educationText: (profile as any)?.education_level,
    });
    const planLines = plan.map((p) => `Year ${p.year} = ${p.schoolYear} school year${p.stage ? ` (${p.stage})` : ""}`).join("\n");
    const stageKnown = plan.some((p) => p.stage);
    const withPlan = (milestone: any) => ({
      ...milestone,
      school_year: plan[Number(milestone.year) - 1]?.schoolYear ?? null,
      stage: plan[Number(milestone.year) - 1]?.stage ?? null,
    });

    const pathCount = data.years <= 5 ? "3" : "2";
    const sys = `You are Ascend's Life Path Simulator, a sharp, warm college and career mentor for a high school student. Today is ${today}.

Generate exactly ${pathCount} genuinely different pathways over ${data.years} years, one milestone per year. If there are 3: a primary path, a stretch path, and an alternative discipline or affordable route. If there are 2: a primary path and an alternative or more affordable route.

TIMELINE RULES (most important):
- Anchor every milestone to the SCHOOL-YEAR TIMELINE in the user message. Mention the school year, and the stage when it is known, in each description. If the stage is not known, say so in the explanation and do not assume the student's grade.
- State the timeline assumption in one sentence in the explanation, for example which school year you assumed they start senior year.
- College applications are submitted in the fall of senior year, and a student cannot attend college before finishing 12th grade. Applying, being admitted, and attending are separate steps. Put "attending" only in years after graduation, and never write "senior year at" a college unless the timeline shows college year 4.
- Use each program's real deadline month in the matching school year. If a catalog deadline is already past (today is ${today}), plan for the next cycle and tell the student to confirm the new dates.
- Do not claim a past achievement unless it is in the profile or in an earlier milestone of the same path. Admissions, scholarships, and funding are conditional: write "apply for" or "if admitted", never "you will receive" or "waived".

DEPTH AND SPECIFICITY RULES (most important):
- Each path must contain exactly ${data.years} milestones, one for every year from 1 to ${data.years}, numbered in order. Count them before answering. Never skip, merge, or stop early, and give the later years the same detail as the early ones.
- Read the full profile. Every milestone must reference at least one concrete detail from it: a named skill, club, award, language, school, location, intended major, financial situation, or tracker item. Never write advice that could apply to any student.
- Build on what they already have. Name their existing strengths and say exactly how to level each one up. Name the gaps between their profile and the goal, and close one specific gap per year.
- Every year must be different. Each milestone title must name the main concrete thing that year (a course, exam, program, competition, project, or application), for example "Sophomore year: AP Biology and the USABO Open Exam", never a theme like "Build your foundation" or "Gain experience". No two milestones in any path may share a title, an action step, or the same wording.
- The paths must differ in substance: different programs, different college routes, different year-by-year focus. Do not copy one path with renamed titles.
- Name real programs, courses, exams, and organizations (for example AP Biology, a named Coursera or Khan Academy course, HOSA, USABO, community college dual enrollment, a named hospital volunteer program in their region). Prefer opportunities from the catalog. When you use one, put its exact id in opportunity_ids and mention it by name with its deadline. Only use catalog ids that appear in the list. If you are not sure of a real program's dates or details, say to confirm on the official site. Never invent programs, URLs, or deadlines.
- description: 60 to 90 words. Explain what the year actually looks like in practice: which months, which classes or programs, roughly how many hours per week, and who they work with.
- why_you: 30 to 50 words, citing specific profile details and explaining why this step fits this student in particular.
- action_steps: 4 to 5 steps, each 15 to 30 words. Each step must give a month or season, a quantity (hours, projects, applications, or people to contact), and a named course, program, exam, organization, tool, or catalog item. Make them checkable.
- targets: 3 to 5 specific, named things to aim for that year. Each is a real program, competition, scholarship, certification, course, lab, or college department, written as "Name: why it fits this student and when to apply or compete". Pick them for this student's field, level, location, and finances (for example USACO divisions, MIT Beaver Works Summer Institute, Stanford SIMR, HOSA competitions, Questbridge, named community college dual enrollment courses). Use catalog items by name when they fit. Only name things you are confident really exist, and tell the student to confirm dates on the official site.
- checkpoint: one measurable sentence describing what must be true by the end of the year.
- skills: 3 to 5 specific skills, such as "Python data analysis with pandas", never just "communication" or "teamwork".
- resources: 2 to 4 named resources a student can actually look up. No URLs.
- salary_range: a realistic US range with a typical early-career figure and a later-career figure, and the assumption behind it.
- education_required: the specific degrees, licenses, or certifications and roughly how long they take.
- financial_strategy: 3 to 4 sentences with named aid sources, fee waivers, and in-state or community college options that fit this student's situation.
- Respect money. If they need aid or a full ride, prioritize free programs, fee waivers, QuestBridge, Posse, and in-state options. Never recommend a paid program without a funded alternative.
- Honor foster, housing, or immigration context when present, naming the specific supports it unlocks.
- Tracker items already APPLIED or ACCEPTED must be built on, not recommended again.
- Plain, encouraging language a 9th grader understands. No em dashes. Never use filler such as "work hard", "stay focused", "explore your interests", "network", or "gain experience" unless it is followed by the exact named thing to do.
- Before answering, check that no two milestones repeat a title or action step, and that every milestone names at least one profile detail.`;
    const userMsg = `GOAL: ${data.career_goal}
FIELD: ${data.field}
EDUCATION LEVEL: ${data.education_level}
TIME HORIZON: ${data.years} years

SCHOOL-YEAR TIMELINE (today is ${today}; school years start in August):
${planLines}
${stageKnown ? "" : "The student's current grade is not known. Do not assume it.\n"}
USER PROFILE:
${profile ? profileSummary(profile) : "(not completed)"}

TRACKER (what they have already saved/applied/been accepted to):
${trackerLines || "(nothing tracked yet)"}

OPPORTUNITY CATALOG, ranked by this student's personal match score first (id | category | title | deadline | match | why):
${oppCatalog}`;

    const aiRequest = callAI({
      preferProvider: "openrouter",
      model: MODEL,
      timeoutMs: 110_000,
      messages: [{ role: "system", content: sys }, { role: "user", content: userMsg }],
      tools: [{
        type: "function",
        function: {
          name: "life_paths",
          description: "Return alternative life pathways",
          parameters: {
            type: "object",
            properties: {
              explanation: { type: "string", description: "3-4 sentences on why these paths fit THIS student, citing specific profile details." },
              profile_insights: {
                type: "object",
                properties: {
                  strengths: { type: "array", items: { type: "string" }, description: "3-5 specific strengths from their profile, each naming the actual item and why it matters for the goal" },
                  gaps: { type: "array", items: { type: "string" }, description: "3-5 specific gaps between profile and goal, each naming what is missing" },
                  financial_strategy: { type: "string", description: "3-4 sentences with named aid sources and fee waivers" },
                },
                required: ["strengths", "gaps", "financial_strategy"],
                additionalProperties: false,
              },
              paths: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    summary: { type: "string", description: "2-3 sentences describing what makes this path different from the others" },
                    salary_range: { type: "string" },
                    education_required: { type: "string" },
                    skills: { type: "array", items: { type: "string" } },
                    milestones: {
                      type: "array",
                      minItems: data.years,
                      maxItems: data.years,
                      items: LIFE_MILESTONE_ITEM_SCHEMA,
                    },
                  },
                  required: ["name", "summary", "salary_range", "education_required", "skills", "milestones"],
                  additionalProperties: false,
                },
              },
            },
            required: ["explanation", "profile_insights", "paths"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "life_paths" } },
    });

    let aiFailure = "";
    const ai = await Promise.race([
      aiRequest,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 115_000)),
    ]).catch((e) => {
      aiFailure = String((e as Error)?.message ?? e).slice(0, 160);
      return null;
    });
    let parsed: any = {};
    try { parsed = parseAIToolJson(ai); } catch (e) {
      aiFailure = aiFailure || `parse_error: ${String((e as Error)?.message ?? e).slice(0, 120)}`;
    }
    if (!Array.isArray(parsed.paths) || parsed.paths.length === 0) {
      logEvent("ai_fallback_used", { route: "life_path", reason: aiFailure || (ai ? "no_paths_in_response" : "timeout_or_no_response") });
      const fallback = createFallbackLifePaths(data.career_goal, data.field, data.years) as any;
      return { ...fallback, paths: fallback.paths.map((fp: any) => ({ ...fp, milestones: fp.milestones.map(withPlan) })) };
    }
    const totalYears = data.years;
    const tidyMilestones = (raw: any[]) => {
      const cleaned = raw.map((m: any) => ({
        ...m,
        opportunity_ids: (m.opportunity_ids ?? []).filter((id: string) => titles[id]),
      }));
      const inRange = cleaned.every((m: any) => Number.isInteger(Number(m.year)) && Number(m.year) >= 1 && Number(m.year) <= totalYears);
      const ordered = inRange ? cleaned : cleaned.map((m: any, i: number) => ({ ...m, year: i + 1 }));
      const byYear = new Map<number, any>();
      for (const m of ordered) {
        const y = Number(m.year);
        if (!byYear.has(y)) byYear.set(y, m);
      }
      return byYear;
    };

    const fillMissing = async (path: any, have: any[], missing: number[]) => {
      const fillSys = `${sys}\n\nYou are completing an existing pathway. Write ONLY the missing years listed by the user, one milestone per missing year, with the same depth and rules as above. Do not repeat titles or action steps already used.`;
      const base = userMsg.split("\n\nOPPORTUNITY CATALOG")[0];
      const fillUser = `${base}\n\nPATHWAY: ${path.name}\nSUMMARY: ${path.summary}\nALREADY WRITTEN:\n${have.map((m: any) => `Year ${m.year}: ${m.title}`).join("\n")}\n\nMISSING YEARS (write exactly ${missing.length} milestones, for years ${missing.join(", ")}).`;
      const res = await callAIOrNull({
        model: MODEL,
        preferProvider: "openrouter",
        timeoutMs: 110_000,
        messages: [{ role: "system", content: fillSys }, { role: "user", content: fillUser }],
        tools: [{
          type: "function",
          function: {
            name: "milestones",
            description: "Return the missing yearly milestones",
            parameters: {
              type: "object",
              properties: {
                milestones: { type: "array", minItems: missing.length, maxItems: missing.length, items: LIFE_MILESTONE_ITEM_SCHEMA },
              },
              required: ["milestones"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "milestones" } },
      });
      try {
        const out = parseAIToolJson(res);
        return Array.isArray(out.milestones) ? (out.milestones as any[]) : [];
      } catch {
        return [];
      }
    };

    const starter = createFallbackLifePaths(data.career_goal, data.field, totalYears).paths[0].milestones;
    const paths = await Promise.all((parsed.paths as any[]).map(async (p) => {
      const byYear = tidyMilestones(Array.isArray(p.milestones) ? p.milestones : []);
      let missing = Array.from({ length: totalYears }, (_, i) => i + 1).filter((y) => !byYear.has(y));
      if (missing.length > 0) {
        const added = await fillMissing(p, [...byYear.values()].sort((x, y) => Number(x.year) - Number(y.year)), missing);
        const addedTidy = added.map((m: any) => ({
          ...m,
          opportunity_ids: (m.opportunity_ids ?? []).filter((id: string) => titles[id]),
        }));
        missing.forEach((y, i) => {
          if (addedTidy[i]) byYear.set(y, { ...addedTidy[i], year: y });
        });
        missing = missing.filter((y) => !byYear.has(y));
        logEvent("ai_fallback_used", { route: "life_path_fill", reason: `filled ${added.length} of ${added.length + missing.length} missing years` });
      }
      for (const y of missing) byYear.set(y, starter[y - 1]);
      const milestones = Array.from({ length: totalYears }, (_, i) => byYear.get(i + 1)).filter(Boolean);
      return { ...p, milestones: milestones.map(withPlan) };
    }));
    return {
      explanation: String(parsed.explanation ?? ""),
      profile_insights: parsed.profile_insights ?? null,
      opportunity_titles: titles,
      paths,
    };
  });

/**
 * Translate an opportunity's title, description, and eligibility for a family member.
 */
export const translateOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    opportunityId: z.string().uuid(),
    language: z.enum(["es", "zh-Hant", "vi", "zh-Hans", "tl", "ko", "hi", "fr", "ar"]),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: opp } = await supabase
      .from("opportunities")
      .select("title,organization,description,eligibility")
      .eq("id", data.opportunityId)
      .maybeSingle();
    if (!opp) throw new Error("Opportunity not found");

    const langNames: Record<string, string> = {
      es: "Spanish",
      "zh-Hant": "Traditional Chinese (Cantonese-speaking families)",
      "zh-Hans": "Simplified Chinese (Mandarin-speaking families)",
      hi: "Hindi",
      fr: "French",
      ar: "Arabic (write right to left, in Modern Standard Arabic)",
      vi: "Vietnamese",
      tl: "Tagalog",
      ko: "Korean",
    };

    const sys = `You are a translator helping a first-generation student explain an opportunity to a parent or guardian. Translate the provided fields to ${langNames[data.language]}. Use warm, plain language a parent without higher-education background can understand. Preserve dollar amounts, proper names of organizations, and deadline-related words.`;
    const userMsg = `Title: ${opp.title}\nOrganization: ${opp.organization}\nDescription: ${opp.description}\nWho qualifies: ${opp.eligibility}`;

    const ai = await callAI({
      model: MODEL,
      messages: [{ role: "system", content: sys }, { role: "user", content: userMsg }],
      tools: [{
        type: "function",
        function: {
          name: "translation",
          description: "Return translated fields",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              eligibility: { type: "string" },
              parent_note: { type: "string", description: "1-2 sentence note for the parent in their language explaining why their student is sharing this." },
            },
            required: ["title", "description", "eligibility", "parent_note"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "translation" } },
    });

    let parsed: any = {};
    try { parsed = parseAIToolJson(ai); } catch {}
    return {
      title: String(parsed.title ?? ""),
      description: String(parsed.description ?? ""),
      eligibility: String(parsed.eligibility ?? ""),
      parent_note: String(parsed.parent_note ?? ""),
    };
  });


/**
 * Build the signed-in student's own deadline digest, so they can preview
 * exactly what will land in their inbox before turning it on.
 */
export const generateDigestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { buildDigestForUser } = await import("@/lib/digest.server");
    const digest = await buildDigestForUser(context.userId);
    if (!digest) {
      return { empty: true as const, subject: "", text: "", html: "" };
    }
    return { empty: false as const, subject: digest.subject, text: digest.text, html: digest.html };
  });


export const browseCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ category: z.string().min(1).max(40) }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const today = todayPacific();
    const categoryId = normalizeCategory(data.category);
    const dbCategories = dbCategoriesFor(categoryId);

    const { data: profile, error: pErr } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (pErr) throw new Error(pErr.message);

    const rows: any[] = [];
    const pageSize = 1000;
    for (let page = 0; page < 4; page++) {
      const { data: chunk, error } = await supabase
        .from("opportunities")
        .select("id,title,organization,category,description,eligibility,tags,related_skills,competitiveness,underrepresented,value_usd,application_fee,fee_waiver_available,travel_required,equipment_needed,format,deadline,location,remote")
        .eq("status", "approved")
        .in("category", dbCategories)
        .or(`deadline.is.null,deadline.gte.${today}`)
        .order("id", { ascending: true })
        .range(page * pageSize, page * pageSize + pageSize - 1);
      if (error) throw new Error(error.message);
      if (!chunk?.length) break;
      rows.push(...chunk);
      if (chunk.length < pageSize) break;
    }

    const ranked = profile ? hybridRank(rows, profile as unknown as RankProfile, new Date()).map((r) => r.opportunity) : [];
    const rankedIds = new Set(ranked.map((o: any) => o.id));
    const rest = rows.filter((o) => !rankedIds.has(o.id));
    const items = [...ranked, ...rest].slice(0, 150).map((o: any) => ({
      id: o.id,
      title: o.title,
      organization: o.organization,
      category: o.category,
      description: o.description,
      deadline: o.deadline,
      location: o.location,
      value_usd: o.value_usd,
      underrepresented: o.underrepresented,
      competitiveness: o.competitiveness,
      application_fee: o.application_fee,
      fee_waiver_available: o.fee_waiver_available,
      travel_required: o.travel_required,
      equipment_needed: o.equipment_needed,
      format: o.format,
      remote: o.remote,
    }));
    return { items, total: rows.length };
  });
