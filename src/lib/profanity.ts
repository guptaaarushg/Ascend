                                                                         
const VULGAR_WORDS = [
  "fuck", "fucking", "fucker", "fuckin", "motherfucker", "mofo",
  "bitch", "bitches", "biatch",
  "cunt", "twat",
  "asshole", "arsehole", "ass-hole",
  "dick", "dickhead", "cock", "cocksucker",
  "pussy",
  "bastard",
  "slut", "whore", "hoe",
  "faggot", "fag",
  "retard", "retarded",
  "nigger", "nigga", "n1gger", "n1gga",
  "chink", "spic", "kike", "gook", "wetback",
  "tranny", "dyke",
  "wanker", "wank",
  "jackoff", "jerkoff",
  "boner",
  "damn", "goddamn",
];

                                                               
function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/[@]/g, "a")
    .replace(/[0]/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[$5]/g, "s")
    .replace(/[7]/g, "t")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ");
}

const PATTERN = new RegExp(
  `\\b(${VULGAR_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
  "i",
);

export function containsProfanity(text: string): boolean {
  if (!text) return false;
  return PATTERN.test(normalize(text));
}

export const FAMILY_FRIENDLY_MESSAGE =
  "Let's please keep it family friendly.";
