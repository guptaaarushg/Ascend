export type Place = { city: string | null; state: string | null; usa: boolean };

export type FitKind = "online" | "national" | "city" | "state" | "elsewhere" | "unknown";

export type LocationFit = { kind: FitKind; score: number; label: string | null };

export type LocatableOpportunity = {
  location?: string | null;
  remote?: boolean | null;
  format?: string | null;
  travel_required?: boolean | null;
  description?: string | null;
};

const STATES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
  connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID",
  illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA",
  maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR",
  pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
  tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA",
  "west virginia": "WV", wisconsin: "WI", wyoming: "WY", "district of columbia": "DC",
};

const ABBRS = new Set(Object.values(STATES));

const CITY_ALIASES: Record<string, string> = {
  nyc: "new york", "new york city": "new york", brooklyn: "new york", manhattan: "new york",
  queens: "new york", bronx: "new york", "staten island": "new york", sf: "san francisco",
  la: "los angeles", philly: "philadelphia",
};

const CITY_STATES: Record<string, string> = {
  "new york": "NY", "san francisco": "CA", "los angeles": "CA", "san diego": "CA", "san jose": "CA",
  "bay area": "CA", chicago: "IL", boston: "MA", seattle: "WA", houston: "TX", dallas: "TX",
  austin: "TX", atlanta: "GA", philadelphia: "PA", pittsburgh: "PA", denver: "CO", miami: "FL",
  baltimore: "MD", detroit: "MI", minneapolis: "MN", portland: "OR",
};

const FOREIGN_RE = /\b(uk|united kingdom|england|scotland|germany|switzerland|france|china|japan|india|canada|mexico|singapore|israel|italy|spain|taiwan|tw|korea|australia|brazil|netherlands|sweden|denmark|ireland|hong kong|dubai|uae|egypt|kenya|ghana|nigeria)\b/;

const ONLINE_RE = /\b(online|virtual|remote|zoom|distance learning)\b/;
const NATIONAL_RE = /\b(nationwide|national|united states|usa|us wide|various|varies|global|worldwide|anywhere|multiple|all states|across the (us|country))\b/;
const COVERED_RE = /(travel|housing|room and board|lodging|airfare)[^.]{0,50}(covered|provided|paid|free|stipend|included)|fully funded|all expenses (paid|covered)/;

function norm(text: string): string {
  return text
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^a-z0-9,&;/| -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanCity(city: string): string {
  const c = city.replace(/\bsaint\b/g, "st").trim();
  return CITY_ALIASES[c] ?? c;
}

function stateOf(token: string): string | null {
  const t = token.trim().replace(/\s*\d{5}(-\d{4})?$/, "");
  if (STATES[t]) return STATES[t];
  const up = t.toUpperCase();
  if (up.length === 2 && ABBRS.has(up)) return up;
  if (t === "dc" || t === "washington dc" || t === "washington d c") return "DC";
  return null;
}

function withCityState(p: { city: string | null; state: string | null }): { city: string | null; state: string | null } {
  if (!p.state && p.city && CITY_STATES[p.city]) return { city: p.city, state: CITY_STATES[p.city] };
  return p;
}

function parseSegment(raw: string): { city: string | null; state: string | null } {
  return withCityState(parseSegmentRaw(raw));
}

function parseSegmentRaw(raw: string): { city: string | null; state: string | null } {
  const t = norm(raw);
  if (!t || t === "null" || t === "none" || t === "n/a") return { city: null, state: null };
  if (t.includes("washington dc") || t.includes("district of columbia") || t === "dc") {
    return { city: "washington", state: "DC" };
  }
  const parts = t.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const st = stateOf(parts[parts.length - 1]);
    if (st) return { city: cleanCity(parts[0]), state: st };
    return { city: cleanCity(parts[0]), state: null };
  }
  const whole = parts[0] ?? "";
  const stOnly = stateOf(whole);
  if (stOnly) return { city: null, state: stOnly };
  const words = whole.split(" ");
  if (words.length >= 2) {
    const lastTwo = words.slice(-2).join(" ");
    const s2 = STATES[lastTwo];
    if (s2) return { city: cleanCity(words.slice(0, -2).join(" ")) || null, state: s2 };
    const last = words[words.length - 1];
    const s1 = stateOf(last);
    if (s1 && last.length >= 2) return { city: cleanCity(words.slice(0, -1).join(" ")), state: s1 };
  }
  return { city: whole ? cleanCity(whole) : null, state: null };
}

export function parsePlace(location: string | null | undefined, country?: string | null): Place {
  const usa = !country || /\b(united states|usa|us|america)\b/i.test(country.replace(/\./g, ""));
  if (!location) return { city: null, state: null, usa };
  const seg = parseSegment(location);
  return { city: seg.city, state: seg.state, usa };
}

export function hasPlace(p: Place | null | undefined): boolean {
  return !!p && p.usa && (!!p.city || !!p.state);
}

function segmentsOf(location: string): string[] {
  const base = norm(location).split(/;|(?<!,)\s(?:or|and)\s|&|\/|\|/).map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  for (const seg of base) {
    const parts = seg.split(",").map((x) => x.trim().replace(/^(and|or)\s+/, "")).filter(Boolean);
    if (parts.length >= 2 && parts.every((x) => stateOf(x))) out.push(...parts);
    else out.push(seg);
  }
  return out;
}

export function isOnline(o: LocatableOpportunity): boolean {
  const fmt = (o.format ?? "").toLowerCase();
  if (fmt === "virtual") return true;
  const loc = norm(o.location ?? "");
  if (loc && ONLINE_RE.test(loc)) return true;
  if (o.remote === true && fmt !== "in_person" && fmt !== "hybrid") return true;
  if (o.remote === true && !loc) return true;
  return false;
}

export function locationFit(user: Place | null | undefined, o: LocatableOpportunity): LocationFit {
  if (isOnline(o)) return { kind: "online", score: 3, label: "Online" };

  const loc = o.location ?? "";
  const normalized = norm(loc);
  const segments = segmentsOf(loc).filter((s) => !NATIONAL_RE.test(s) && !ONLINE_RE.test(s));
  const parsed = segments.map((text) => ({ p: parseSegment(text), text })).filter(({ p }) => p.city || p.state);
  

  if (parsed.length === 0) {
    if (normalized && NATIONAL_RE.test(normalized)) return { kind: "national", score: 1, label: null };
    return { kind: "unknown", score: 0, label: null };
  }
  if (!hasPlace(user)) return { kind: "unknown", score: 0, label: null };

  const u = user as Place;
  let best: LocationFit | null = null;
  for (const { p, text } of parsed) {
    let fit: LocationFit;
    if (!p.state && FOREIGN_RE.test(text)) {
      fit = { kind: "elsewhere", score: -3, label: "Travel needed" };
    } else if (u.state && p.state) {
      if (u.state !== p.state) fit = { kind: "elsewhere", score: -3, label: "Travel needed" };
      else if (u.city && p.city && u.city === p.city) fit = { kind: "city", score: 8, label: "Near you" };
      else fit = { kind: "state", score: 5, label: "In your state" };
    } else if (u.city && p.city) {
      fit = u.city === p.city ? { kind: "city", score: 8, label: "Near you" } : { kind: "unknown", score: 0, label: null };
    } else if (u.state && !p.state) {
      fit = { kind: "unknown", score: 0, label: null };
    } else {
      fit = { kind: "unknown", score: 0, label: null };
    }
    if (!best || fit.score > best.score) best = fit;
  }
  const result = best as LocationFit;
  if (result.kind === "elsewhere") {
    const fmt = (o.format ?? "").toLowerCase();
    const text = norm(`${o.description ?? ""}`);
    if (fmt === "hybrid" || o.travel_required === false) return { kind: "unknown", score: 0, label: null };
    if (COVERED_RE.test(text)) return { kind: "elsewhere", score: 0, label: "Travel may be covered" };
  }
  return result;
}

const EMPTY_LOCATIONS = new Set(["", "null", "none", "n/a", "na", "undefined", "tbd", "unknown"]);

export function cleanLocation(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const parts = raw
    .split(/\s*[;|]\s*|,\s*(?=online\b|virtual\b|remote\b)/i)
    .map((p) => p.trim())
    .filter((p) => !EMPTY_LOCATIONS.has(p.toLowerCase()));
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const part of parts) {
    const collapsed = part.replace(/\b(online|virtual|remote)(\s*[,/&-]?\s*\1\b)+/gi, "$1");
    const key = collapsed.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      kept.push(collapsed);
    }
  }
  return kept.length > 0 ? kept.join("; ") : null;
}
