import { z } from "zod";

   
                                                                          
                                                                       
                                                              
   

                                                                         
                                                            
export function sanitizeText(input: unknown): string {
  return String(input ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\uFEFF]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

const short = (max: number) =>
  z.preprocess(sanitizeText, z.string().max(max));

const longText = (max: number) =>
  z.preprocess(sanitizeText, z.string().max(max));

const tagList = (maxItems: number, maxLen = 80) =>
  z.preprocess(
    (v) =>
      Array.isArray(v)
        ? v.map(sanitizeText).filter(Boolean).slice(0, maxItems)
        : [],
    z.array(z.string().min(1).max(maxLen)).max(maxItems),
  );

export const profileSchema = z.object({
  display_name: short(80),
  age_range: short(40),
  education_level: short(80),
  location: short(120),
  country: short(80),
  academic_interests: tagList(50),
  career_interests: tagList(50),
  skills: tagList(50),
  extracurriculars: tagList(50),
  certifications: tagList(50),
  languages: tagList(50),
  bio: longText(2000),
  professional_experience: longText(2000),
  socioeconomic_info: longText(2000),
  long_term_goals: longText(2000),

  dream_colleges: tagList(50, 120),
  target_colleges: tagList(50, 120),
  safety_colleges: tagList(50, 120),
  intended_major: short(120),
  college_application_year: short(20),
  college_notes: longText(2000),
  immigration_status_note: longText(500),
  applying_with_financial_aid: z.boolean().nullable().optional(),
  needs_full_ride: z.boolean().nullable().optional(),
  foster_youth_status: z.boolean().nullable().optional(),
  housing_insecure_status: z.boolean().nullable().optional(),
});

export const cohortNameSchema = z.preprocess(
  sanitizeText,
  z.string().min(2, "Give the cohort a name of at least 2 characters").max(80, "Keep the cohort name under 80 characters"),
);

export const inviteCodeSchema = z.preprocess(
  (v) => sanitizeText(v).toUpperCase(),
  z.string().regex(/^[A-Z0-9-]{4,20}$/, "That invite code does not look right"),
);

                                                
export function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Please check your input";
}
