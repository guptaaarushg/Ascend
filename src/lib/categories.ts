import { formatDeadline } from "@/lib/dates";
   
                                                                           
                                                                   
   
export const OPPORTUNITY_CATEGORIES = [
  { id: "scholarship", label: "Scholarships" },
  { id: "summer_program", label: "Summer programs" },
  { id: "competition", label: "Competitions" },
  { id: "internship", label: "Internships" },
  { id: "research", label: "Research" },
  { id: "fellowship", label: "Fellowships" },
  { id: "grant", label: "Grants" },
  { id: "certification", label: "Certifications" },
  { id: "benefit", label: "Benefits" },
  { id: "volunteer", label: "Volunteering" },
  { id: "mentorship", label: "Mentorship" },
  { id: "job", label: "Jobs" },
] as const;

                                                                   
const CATEGORY_ALIASES: Record<string, string> = {
  "summer program": "summer_program",
  program: "summer_program",
  leadership: "summer_program",
  community: "volunteer",
  community_resource: "benefit",
  funding: "grant",
  government_benefit: "benefit",
  tax_credit: "benefit",
  tutoring: "mentorship",
  entrepreneurial: "grant",
};

export function normalizeCategory(id: string | null | undefined) {
  const key = (id ?? "").trim().toLowerCase();
  return CATEGORY_ALIASES[key] ?? key;
}

export function dbCategoriesFor(id: string): string[] {
  const out = new Set<string>([id]);
  for (const [alias, target] of Object.entries(CATEGORY_ALIASES)) {
    if (target === id) out.add(alias);
  }
  return [...out];
}

export type CategoryId = (typeof OPPORTUNITY_CATEGORIES)[number]["id"];

export function categoryLabel(id: string) {
  const norm = normalizeCategory(id);
  return OPPORTUNITY_CATEGORIES.find((c) => c.id === norm)?.label ?? id;
}

   
                                                                               
                                                                  
   
export const ROLLING_DEADLINE_LABEL = "Deadline not listed, check the program site";

export function deadlineLabel(deadline: string | null | undefined) {
  if (!deadline) return ROLLING_DEADLINE_LABEL;
  return formatDeadline(deadline);
}
                                                                          
export function categoryEmoji(_id: string) {
  return "";
}

