import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { generateMatches } from "@/lib/ascend.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { profileSchema, firstError } from "@/lib/validation";
import { containsProfanity, FAMILY_FRIENDLY_MESSAGE } from "@/lib/profanity";

import { ArrowRight, ArrowLeft, UserRound } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

type ProfileForm = {
  display_name: string;
  age_range: string;
  education_level: string;
  location: string;
  country: string;
  academic_interests: string;
  career_interests: string;
  skills: string;
  extracurriculars: string;
  certifications: string;
  languages: string;
  professional_experience: string;
  socioeconomic_info: string;
  long_term_goals: string;
};

const AGE_RANGES = ["Under 16", "16, 18", "19, 22", "23, 29", "30, 39", "40, 49", "50+"];
const EDU_LEVELS = ["Middle school", "High school", "Undergraduate"];

const STEPS = [
  { id: "basics", label: "About you" },
  { id: "interests", label: "Interests & skills" },
  { id: "experience", label: "Experience" },
  { id: "context", label: "Context & goals" },
] as const;

function csv(s: string): string[] {
  // Accept commas, semicolons, slashes, newlines, bullets, pipes, " and ", " & "
  return s
    .split(/[,;\n\r\u2022|/]+|\s+and\s+|\s+&\s+/i)
    .map((x) => x.replace(/^[\s\-•*\.]+|[\s\-•*\.]+$/g, "").trim())
    .filter((x) => x.length > 0 && x.length < 200);
}


function Onboarding() {
  const navigate = useNavigate();
  const runMatches = useServerFn(generateMatches);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<ProfileForm>({
    display_name: "", age_range: "", education_level: "", location: "", country: "United States",
    academic_interests: "", career_interests: "", skills: "", extracurriculars: "", certifications: "",
    languages: "English", professional_experience: "", socioeconomic_info: "", long_term_goals: "",
  });

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: p } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      if (p) {
        setForm({
          display_name: p.display_name ?? "", age_range: p.age_range ?? "", education_level: p.education_level ?? "",
          location: p.location ?? "", country: p.country ?? "United States",
          academic_interests: (p.academic_interests ?? []).join(", "),
          career_interests: (p.career_interests ?? []).join(", "),
          skills: (p.skills ?? []).join(", "),
          extracurriculars: (p.extracurriculars ?? []).join(", "),
          certifications: (p.certifications ?? []).join(", "),
          languages: (p.languages ?? []).join(", ") || "English",
          professional_experience: p.professional_experience ?? "",
          socioeconomic_info: p.socioeconomic_info ?? "",
          long_term_goals: p.long_term_goals ?? "",
        });
      }
    })();
  }, []);

  const update = <K extends keyof ProfileForm>(k: K, v: ProfileForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const handleFinish = async () => {
    const draft = {
      display_name: form.display_name,
      age_range: form.age_range,
      education_level: form.education_level,
      location: form.location,
      country: form.country,
      academic_interests: csv(form.academic_interests),
      career_interests: csv(form.career_interests),
      skills: csv(form.skills),
      extracurriculars: csv(form.extracurriculars),
      certifications: csv(form.certifications),
      languages: csv(form.languages),
      professional_experience: form.professional_experience,
      socioeconomic_info: form.socioeconomic_info,
      long_term_goals: form.long_term_goals,
      dream_colleges: [],
      target_colleges: [],
      safety_colleges: [],
      intended_major: "",
      college_application_year: "",
      college_notes: "",
      immigration_status_note: "",
    };
    const parsed = profileSchema.safeParse(draft);
    if (!parsed.success) { toast.error(firstError(parsed.error)); return; }
    const clean = parsed.data as Record<string, any>;
    const dirty = [clean.display_name, clean.location, clean.country, clean.professional_experience, clean.socioeconomic_info, clean.long_term_goals]
      .some((v) => containsProfanity(String(v ?? "")));
    if (dirty) { toast.error(FAMILY_FRIENDLY_MESSAGE); return; }

    setSubmitting(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("profiles").upsert({
        id: u.user.id,
        display_name: clean.display_name,
        age_range: clean.age_range,
        education_level: clean.education_level,
        location: clean.location,
        country: clean.country,
        academic_interests: clean.academic_interests,
        career_interests: clean.career_interests,
        skills: clean.skills,
        extracurriculars: clean.extracurriculars,
        certifications: clean.certifications,
        languages: clean.languages,
        professional_experience: clean.professional_experience,
        socioeconomic_info: clean.socioeconomic_info,
        long_term_goals: clean.long_term_goals,
        onboarded: true,
      });
      if (error) throw error;


      toast.success("Profile saved. Generating matches…");
      try {
        const res = await runMatches({ data: { rescoreAll: true } });
        toast.success(`Found ${res.matched} matched opportunities for you.`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Match generation failed");
      }
      navigate({ to: "/feed", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">

      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs mb-3 font-medium tracking-wide uppercase">
          <UserRound className="size-3.5" /> Life Profile
        </div>
        <h1 className="text-3xl font-bold">Build your opportunity profile</h1>
        <p className="text-muted-foreground mt-2">The more we know, the better we can find what's already waiting for you.</p>
      </div>
      <Progress value={progress} className="mb-6" />
      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step].label}</CardTitle>
          <CardDescription>Step {step + 1} of {STEPS.length}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 0 && (
            <>
              <Field label="Your name"><Input value={form.display_name} onChange={(e) => update("display_name", e.target.value)} /></Field>
              <Field label="Age range"><Select value={form.age_range} onValueChange={(v) => update("age_range", v)}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>{AGE_RANGES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select></Field>
              <Field label="Current education / stage"><Select value={form.education_level} onValueChange={(v) => update("education_level", v)}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>{EDU_LEVELS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select></Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="City / region"><Input value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="Brooklyn, NY" /></Field>
                <Field label="Country"><Input value={form.country} onChange={(e) => update("country", e.target.value)} /></Field>
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <Field label="Academic interests" hint="Separate with commas, new lines, or 'and', spelling and grammar don't matter.">
                <Textarea rows={3} value={form.academic_interests} onChange={(e) => update("academic_interests", e.target.value)} placeholder="e.g. computer science, biology, philosophy" />
              </Field>
              <Field label="Career interests" hint="What kind of work excites you?">
                <Textarea rows={3} value={form.career_interests} onChange={(e) => update("career_interests", e.target.value)} placeholder="software engineering, social impact, design" />
              </Field>
              <Field label="Skills" hint="Technical or otherwise, list as many as you want.">
                <Textarea rows={3} value={form.skills} onChange={(e) => update("skills", e.target.value)} placeholder="python, public speaking, video editing" />
              </Field>
              <Field label="Languages spoken">
                <Textarea rows={2} value={form.languages} onChange={(e) => update("languages", e.target.value)} />
              </Field>
            </>
          )}
          {step === 2 && (
            <>
              <Field label="Extracurriculars & activities" hint="Clubs, sports, volunteering, hobbies, side projects, anything.">
                <Textarea rows={4} value={form.extracurriculars} onChange={(e) => update("extracurriculars", e.target.value)} placeholder="robotics club, varsity soccer, volunteer tutor" />
              </Field>
              <Field label="Certifications / awards">
                <Textarea rows={3} value={form.certifications} onChange={(e) => update("certifications", e.target.value)} placeholder="AWS Cloud Practitioner, National Merit Finalist" />
              </Field>
              <Field label="Professional experience (free text)">
                <Textarea value={form.professional_experience} onChange={(e) => update("professional_experience", e.target.value)} rows={6} placeholder="Internships, jobs, projects, side ventures…" />
              </Field>
            </>
          )}
          {step === 3 && (
            <>
              <Field label="Socioeconomic context" hint="Optional. Helps surface need-based programs.">
                <Textarea value={form.socioeconomic_info} onChange={(e) => update("socioeconomic_info", e.target.value)} rows={5} placeholder="First-generation college student, Pell-eligible, single-income household…" />
              </Field>
              <Field label="Long-term goals">
                <Textarea value={form.long_term_goals} onChange={(e) => update("long_term_goals", e.target.value)} rows={6} placeholder="Where do you want to be in 5 years? What would success look like?" />
              </Field>
            </>
          )}
          <div className="flex justify-between pt-4">
            <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft className="size-4 mr-1" /> Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)}>Next <ArrowRight className="size-4 ml-1" /></Button>
            ) : (
              <Button onClick={handleFinish} disabled={submitting}>
                {submitting ? "Finding matches…" : "Finish & match me"} <ArrowRight className="size-4 ml-1" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
