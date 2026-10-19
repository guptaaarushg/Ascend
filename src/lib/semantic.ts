/**
 * Local semantic layer for hybrid retrieval.
 *
 * WHY THIS EXISTS
 * Stage-one retrieval used to be pure lexical (tf-idf). That fails on the most
 * common thing a student actually writes: "I want to build robots" never
 * overlaps with "FIRST Tech Challenge mechatronics mentorship", so the best
 * program in the catalog stays invisible.
 *
 * WHY IT IS NOT AN EMBEDDING API
 * Every request to an external embedding service is a dependency that can rate
 * limit, cost money, drift between model versions, and take the whole feed down
 * with it. Ascend runs on Cloudflare Workers where a cold call is also latency
 * a student feels. So the semantic layer is computed in-process and is fully
 * deterministic:
 *
 *   1. A hand-built concept ontology maps natural student language onto the
 *      vocabulary programs actually use ("build robots" -> robotics, mechatronics,
 *      FIRST, FTC, VEX, embedded).
 *   2. Text is projected into a fixed 256-dimensional space with the hashing
 *      trick (FNV-1a hash + signed accumulation over unigrams, bigrams, and
 *      activated concepts). This is a random-projection sketch of the bag of
 *      concepts, the same idea behind feature hashing in production ranking
 *      systems, minus the model weights.
 *   3. Similarity is plain cosine on L2-normalized vectors.
 *
 * The result is semantic recall with zero network calls, zero API keys, and a
 * fully reproducible score, which also makes the offline evaluation harness in
 * src/lib/eval possible.
 */

export const EMBEDDING_DIM = 1024;

/**
 * Concept ontology. Left side is the canonical concept, right side is the
 * surface language that should activate it, from either a student profile or a
 * program listing. Written by hand from the catalog's actual vocabulary.
 *
 * Rule learned the hard way: no ambiguous single words. "first" used to live
 * under robotics and quietly tagged a violinist ("first chair") as a robotics
 * student, and "internship"/"fellowship" appear in half the catalog's titles,
 * so they carried no information at all. Ambiguous surface forms only appear
 * here as multi-word phrases.
 */
export const CONCEPT_ONTOLOGY: Record<string, string[]> = {
  robotics: ["robot", "robots", "robotics", "mechatronics", "first robotics", "first tech challenge", "ftc", "frc", "vex", "botball", "autonomous", "drone", "drones", "embedded", "arduino", "raspberry"],
  computer_science: ["coding", "code", "programming", "software", "developer", "computer", "cs", "usaco", "hackathon", "app", "web", "algorithms", "data structures", "python", "java", "javascript"],
  artificial_intelligence: ["ai", "artificial intelligence", "machine learning", "ml", "neural", "deep learning", "nlp", "computer vision", "llm", "data science", "kaggle"],
  cybersecurity: ["cyber", "cybersecurity", "security", "hacking", "ctf", "cyberpatriot", "cryptography", "network defense"],
  engineering: ["engineer", "engineering", "mechanical", "electrical", "civil", "aerospace", "manufacturing", "cad", "prototype", "design build"],
  biology: ["biology", "bio", "life sciences", "genetics", "genomics", "molecular", "cell", "ecology", "usabo", "biotech", "microbiology"],
  medicine: ["medicine", "medical", "premed", "pre-med", "doctor", "physician", "surgeon", "clinical", "hospital", "nursing", "public health", "healthcare", "shadowing", "emt"],
  neuroscience: ["neuroscience", "brain", "neural", "cognitive", "psychology", "neurology", "brain bee"],
  chemistry: ["chemistry", "chemical", "organic chemistry", "usnco", "materials"],
  physics: ["physics", "astro", "astronomy", "astrophysics", "quantum", "physics olympiad", "usapho", "space", "nasa"],
  mathematics: ["math", "mathematics", "amc", "aime", "usamo", "mathcounts", "olympiad", "statistics", "number theory", "calculus"],
  environment: ["environment", "environmental", "climate", "sustainability", "conservation", "ecology", "renewable", "solar", "agriculture", "farming", "farm", "ffa", "4-h", "crop", "watershed", "soil"],
  law_policy: ["law", "legal", "policy", "government", "civics", "congress", "senate", "debate", "model un", "mock trial", "attorney", "justice", "advocacy", "legislation", "run for office", "elected", "public office", "legislative", "diplomacy"],
  business: ["business", "entrepreneur", "entrepreneurship", "startup", "start my own business", "founder", "finance", "economics", "marketing", "deca", "fbla", "investing", "accounting", "consulting"],
  arts: ["art", "arts", "painting", "drawing", "sculpture", "photography", "film", "animation", "graphic", "portfolio", "theater", "dance", "music", "orchestra", "band", "composition"],
  writing: ["writing", "writer", "journalism", "poetry", "essay", "creative writing", "literature", "english", "author", "publishing", "scholastic"],
  social_impact: ["community service", "volunteer", "nonprofit", "civic", "social impact", "activism", "mutual aid", "outreach"],
  research: ["research", "lab", "laboratory", "publication", "regeneron", "isef", "science fair"],
  leadership: ["leadership", "leader", "president", "founder", "captain", "organizer", "student council", "ambassador"],
  teaching: ["teaching", "teacher", "tutor", "education", "mentor", "curriculum", "instruction"],
  trades: ["trade", "vocational", "apprentice", "welding", "hvac", "automotive", "construction", "electrician", "plumbing", "cte", "fabrication"],
  aviation: ["aviation", "pilot", "flight", "aerospace", "aeronautics", "drone"],
  first_generation: ["first generation", "first-gen", "firstgen", "no college", "parents did not attend"],
  low_income: ["low income", "low-income", "pell", "free lunch", "reduced lunch", "need based", "financial aid", "fafsa", "title i", "underserved", "poverty", "full ride"],
  foster_youth: ["foster", "ward of the state", "ward of the court", "etv", "group home", "kinship care"],
  housing_insecurity: ["homeless", "housing insecure", "unaccompanied youth", "mckinney", "shelter", "couch surfing"],
  immigration: ["undocumented", "daca", "dreamer", "immigrant", "refugee", "asylum", "no ssn", "tps"],
  rural: ["rural", "small town", "farming community", "farm", "ffa", "appalachia", "tribal", "reservation"],
  disability: ["disability", "disabled", "deaf", "blind", "autistic", "neurodivergent", "iep", "accessibility"],
  military: ["veteran", "military", "rotc", "army", "navy", "air force", "service member"],
};

/** Reverse index: surface phrase -> concepts it activates. */
const PHRASE_TO_CONCEPTS = (() => {
  const m = new Map<string, string[]>();
  for (const [concept, phrases] of Object.entries(CONCEPT_ONTOLOGY)) {
    for (const p of phrases) {
      const key = p.toLowerCase();
      const list = m.get(key) ?? [];
      list.push(concept);
      m.set(key, list);
    }
  }
  return m;
})();

const MAX_PHRASE_WORDS = 3;

/**
 * Crude English plural stripping. Students write "laws", "robots", "startups";
 * the ontology stores the singular. A stemmer library would be another
 * dependency for what is three rules.
 */
function singularize(phrase: string): string {
  return phrase.replace(/\b([a-z]{3,}?)(?:ies|es|s)\b/g, (m, stem) =>
    m.endsWith("ies") ? `${stem}y` : stem,
  );
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#/ ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Which concepts a piece of text activates, and how strongly. Multi-word
 * phrases are matched with a sliding window so "machine learning" is one signal
 * rather than two weak ones.
 */
export function conceptsOf(text: string): Map<string, number> {
  const w = words(text);
  const hits = new Map<string, number>();
  for (let i = 0; i < w.length; i++) {
    for (let n = MAX_PHRASE_WORDS; n >= 1; n--) {
      if (i + n > w.length) continue;
      const phrase = w.slice(i, i + n).join(" ");
      const concepts = PHRASE_TO_CONCEPTS.get(phrase) ?? PHRASE_TO_CONCEPTS.get(singularize(phrase));
      if (!concepts) continue;
      // Longer phrases are more specific evidence.
      const weight = n;
      for (const c of concepts) hits.set(c, (hits.get(c) ?? 0) + weight);
      break;
    }
  }
  return hits;
}

/** FNV-1a, 32-bit. Stable across runtimes, which keeps evaluation reproducible. */
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function project(vec: Float64Array, token: string, weight: number) {
  const h = hash32(token);
  const idx = h % EMBEDDING_DIM;
  // Sign bit from a second hash keeps collisions from systematically inflating
  // similarity, the standard signed hashing trick.
  const sign = (hash32(`s:${token}`) & 1) === 0 ? 1 : -1;
  vec[idx] += sign * weight;
}

/**
 * Deterministic dense sketch of a piece of text: unigrams, bigrams, and
 * ontology concepts, hashed into EMBEDDING_DIM dimensions and L2 normalized.
 */
export function embed(text: string, conceptBoost = 6): Float64Array {
  const vec = new Float64Array(EMBEDDING_DIM);
  const w = words(text);
  for (let i = 0; i < w.length; i++) {
    const t = w[i]!;
    // Raw words are deliberately quiet. They are mostly boilerplate ("students",
    // "program", "apply"), and letting them dominate is exactly the failure the
    // concept layer exists to fix. Concepts carry the signal, words break ties.
    if (t.length > 2) project(vec, t, 0.35);
    if (i + 1 < w.length) project(vec, `${t}_${w[i + 1]}`, 0.25);
  }
  for (const [concept, weight] of conceptsOf(text)) {
    project(vec, `c:${concept}`, conceptBoost * Math.log(1 + weight));
  }
  let norm = 0;
  for (let i = 0; i < EMBEDDING_DIM; i++) norm += vec[i]! * vec[i]!;
  norm = Math.sqrt(norm);
  if (norm > 0) for (let i = 0; i < EMBEDDING_DIM; i++) vec[i] = vec[i]! / norm;
  return vec;
}

export function cosine(a: Float64Array, b: Float64Array): number {
  let dot = 0;
  for (let i = 0; i < EMBEDDING_DIM; i++) dot += a[i]! * b[i]!;
  return dot;
}

/**
 * Concept-level overlap, reported separately from the hashed cosine because it
 * is human-readable and used for explanations ("matched on: robotics, research").
 */
export function sharedConcepts(a: string, b: string): string[] {
  const ca = conceptsOf(a);
  const cb = conceptsOf(b);
  const out: string[] = [];
  for (const k of ca.keys()) if (cb.has(k)) out.push(k);
  return out;
}
