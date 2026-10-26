import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { generateMatches } from "@/lib/ascend.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TagInput } from "@/components/ui/tag-input";
import { toast } from "sonner";
import { containsProfanity, FAMILY_FRIENDLY_MESSAGE } from "@/lib/profanity";
import { profileSchema, firstError, inviteCodeSchema } from "@/lib/validation";

import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const EDU_LEVELS = ["Middle school", "High school", "Undergraduate"];

function autoCap(s: string) {
  return s
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ")
    .trim();
}


export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Your Life Profile, Ascend" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const runMatches = useServerFn(generateMatches);
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      setForm({
        display_name: data?.display_name ?? "",
        age_range: data?.age_range ?? "",
        education_level: data?.education_level ?? "",
        location: data?.location ?? "",
        country: data?.country ?? "",
        academic_interests: data?.academic_interests ?? [],
        career_interests: data?.career_interests ?? [],
        skills: data?.skills ?? [],
        extracurriculars: data?.extracurriculars ?? [],
        certifications: data?.certifications ?? [],
        languages: data?.languages ?? [],
        professional_experience: data?.professional_experience ?? "",
        socioeconomic_info: data?.socioeconomic_info ?? "",
        long_term_goals: data?.long_term_goals ?? "",
        dream_colleges: data?.dream_colleges ?? [],
        target_colleges: data?.target_colleges ?? [],
        safety_colleges: data?.safety_colleges ?? [],
        intended_major: data?.intended_major ?? "",
        applying_with_financial_aid: data?.applying_with_financial_aid ?? null,
        needs_full_ride: data?.needs_full_ride ?? null,
        college_application_year: data?.college_application_year ?? "",
        college_notes: data?.college_notes ?? "",
        foster_youth_status: data?.foster_youth_status ?? null,
        housing_insecure_status: data?.housing_insecure_status ?? null,
        immigration_status_note: data?.immigration_status_note ?? "",
      });
    })();
  }, []);


  if (!form) return <div className="container mx-auto max-w-3xl px-4 py-8"><div className="h-96 rounded-xl bg-muted animate-pulse" /></div>;

  const save = async () => {
    // Validate + sanitize everything before it leaves the browser. The same
    // limits are enforced by database constraints, so this is a friendly
    // message, not the actual gate.
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(firstError(parsed.error));
      return;
    }
    const clean = parsed.data as Record<string, any>;

    // Family-friendly guard on all free-text fields
    const textFields: [string, string][] = [
      ["Display name", clean.display_name],
      ["City / region", clean.location],
      ["Country", clean.country],
      ["Professional experience", clean.professional_experience],
      ["Socioeconomic context", clean.socioeconomic_info],
      ["Long-term goals", clean.long_term_goals],
      ["Intended major", clean.intended_major],
      ["College notes", clean.college_notes],
      ["Immigration context", clean.immigration_status_note],
    ];

    for (const [label, val] of textFields) {
      if (containsProfanity(String(val ?? ""))) {
        toast.error(`${FAMILY_FRIENDLY_MESSAGE} (${label})`);
        return;
      }
    }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("profiles").upsert({
        id: u.user.id, ...clean,
        display_name: autoCap(clean.display_name),
        location: autoCap(clean.location),
        country: autoCap(clean.country),
        onboarded: true,
      });
      if (error) throw error;

      toast.success("Profile updated. Re-matching…");
      try {
        const res = await runMatches({ data: { rescoreAll: true } });
        toast.success(`Updated ${res.matched} matches.`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Match refresh failed");
      }
      navigate({ to: "/feed" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const set = (k: string, v: string | string[]) => setForm((f: any) => ({ ...f, [k]: v }));

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">Your Life Profile</h1>
      <p className="text-muted-foreground">Edit anything. Saving will re-generate your matches.</p>
      <Card>
        <CardHeader><CardTitle>About you</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="Display name"><Input value={form.display_name} onChange={(e) => set("display_name", e.target.value)} /></Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Age range"><Input value={form.age_range} onChange={(e) => set("age_range", e.target.value)} /></Field>
            <Field label="Education">
              <Select value={form.education_level} onValueChange={(value) => set("education_level", value)}>
                <SelectTrigger><SelectValue placeholder="Select education level" /></SelectTrigger>
                <SelectContent>{EDU_LEVELS.map((level) => <SelectItem key={level} value={level}>{level}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="City / region"><Input value={form.location} onChange={(e) => set("location", e.target.value)} /></Field>
            <Field label="Country"><Input value={form.country} onChange={(e) => set("country", e.target.value)} /></Field>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Interests, skills & experience</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="Academic interests"><TagInput value={form.academic_interests} onChange={(v) => set("academic_interests", v)} placeholder="Add an interest and press Enter" /></Field>
          <Field label="Career interests"><TagInput value={form.career_interests} onChange={(v) => set("career_interests", v)} placeholder="e.g. Medicine, Software Engineering" /></Field>
          <Field label="Skills"><TagInput value={form.skills} onChange={(v) => set("skills", v)} placeholder="e.g. Python, Public Speaking" /></Field>
          <Field label="Extracurriculars"><TagInput value={form.extracurriculars} onChange={(v) => set("extracurriculars", v)} placeholder="e.g. Debate Club, Robotics" /></Field>
          <Field label="Certifications & Awards"><TagInput value={form.certifications} onChange={(v) => set("certifications", v)} placeholder="e.g. CPR, AWS Cloud Practitioner, Science Fair Winner" /></Field>
          <Field label="Languages"><LanguagePicker value={form.languages} onChange={(v) => set("languages", v)} /></Field>

          <Field label="Professional experience"><Textarea value={form.professional_experience} onChange={(e) => set("professional_experience", e.target.value)} rows={3} /></Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>College goals</CardTitle>
          <p className="text-sm text-muted-foreground pt-1">Tell us where you'd love to go and how you plan to pay for it. We'll use this to surface scholarships, fly-in programs, and application-support opportunities that fit your list.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Intended major (or undecided)">
              <Input value={form.intended_major} onChange={(e) => set("intended_major", e.target.value)} placeholder="e.g. Biology, Computer Science, Undecided" />
            </Field>
            <Field label="Applying in (class year)">
              <Input value={form.college_application_year} onChange={(e) => set("college_application_year", e.target.value)} placeholder="e.g. Fall 2027" />
            </Field>
          </div>
          <Field label="Dream schools (reach)">
            <TagInput value={form.dream_colleges} onChange={(v) => set("dream_colleges", v)} placeholder="e.g. Stanford, MIT, Harvard" />
          </Field>
          <Field label="Target schools (good fit / likely)">
            <TagInput value={form.target_colleges} onChange={(v) => set("target_colleges", v)} placeholder="e.g. UMich, UT Austin, Northeastern" />
          </Field>
          <Field label="Safety schools">
            <TagInput value={form.safety_colleges} onChange={(v) => set("safety_colleges", v)} placeholder="e.g. State flagship, in-state public" />
          </Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Applying with financial aid?">
              <YesNoPicker value={form.applying_with_financial_aid} onChange={(v) => set("applying_with_financial_aid", v as any)} />
            </Field>
            <Field label="Do you need a full ride to attend?">
              <YesNoPicker value={form.needs_full_ride} onChange={(v) => set("needs_full_ride", v as any)} />
            </Field>
          </div>
          <Field label="Anything else about your college search">
            <Textarea value={form.college_notes} onChange={(e) => set("college_notes", e.target.value)} rows={3} placeholder="e.g. Need to stay in-state, strongly prefer schools with QuestBridge partnerships, want a research-heavy program…" />
          </Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Your circumstances (all optional)</CardTitle>
          <p className="text-sm text-muted-foreground pt-1">
            Every field here is optional and you can leave all of them blank. Sharing one only unlocks extra funding categories that are set aside for students in that situation. Nothing here is ever used to rule you out of an opportunity, and it is never shown to counselors or other students.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="Have you spent time in foster care?">
            <YesNoPicker value={form.foster_youth_status} onChange={(v) => set("foster_youth_status", v as any)} />
            <p className="text-xs text-muted-foreground">Unlocks foster-youth tuition waivers, ETV funds, and foster-specific scholarships.</p>
          </Field>
          <Field label="Are you dealing with housing insecurity or homelessness?">
            <YesNoPicker value={form.housing_insecure_status} onChange={(v) => set("housing_insecure_status", v as any)} />
            <p className="text-xs text-muted-foreground">Unlocks McKinney-Vento supports, emergency aid, and homeless-youth scholarships.</p>
          </Field>
          <Field label="Anything about your immigration situation we should know?">
            <Textarea
              value={form.immigration_status_note}
              onChange={(e) => set("immigration_status_note", e.target.value)}
              rows={2}
              placeholder="Optional. For example: DACA recipient, no Social Security number, permanent resident."
            />
            <p className="text-xs text-muted-foreground">
              Optional and never required. If you tell us you do not have citizenship or a Social Security number, we stop showing you programs that require one and start showing funds that do not.
            </p>
          </Field>
        </CardContent>
      </Card>

      <CohortCard />
      <NotificationCard />

      <Card>
        <CardHeader><CardTitle>Context & goals</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="Socioeconomic context"><Textarea value={form.socioeconomic_info} onChange={(e) => set("socioeconomic_info", e.target.value)} rows={3} /></Field>
          <Field label="Long-term goals"><Textarea value={form.long_term_goals} onChange={(e) => set("long_term_goals", e.target.value)} rows={4} /></Field>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} size="lg">
          {saving ? "Saving…" : "Save & re-match"} 
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

/** Join a counselor or nonprofit cohort with an invite code. */
function CohortCard() {
  const [code, setCode] = useState("");
  const [joined, setJoined] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase.from("profiles").select("cohort_id").eq("id", u.user.id).maybeSingle();
      if (!data?.cohort_id) return;
      const { data: c } = await supabase.from("cohorts").select("name").eq("id", data.cohort_id).maybeSingle();
      setJoined(c?.name ?? "Your cohort");
    })();
  }, []);

  const redeem = async () => {
    const parsedCode = inviteCodeSchema.safeParse(code);
    if (!parsedCode.success) { toast.error(firstError(parsedCode.error)); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("redeem_cohort_code", { _code: parsedCode.data as string });
      if (error) throw error;

      if (!data) throw new Error("That code did not match any cohort. Double-check it with your counselor.");
      const { data: c } = await supabase.from("cohorts").select("name").eq("id", data as string).maybeSingle();
      setJoined(c?.name ?? "Your cohort");
      setCode("");
      toast.success("You are in. Your counselor will only ever see anonymized group totals.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not join that cohort");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Counselor or program code</CardTitle>
        <p className="text-sm text-muted-foreground pt-1">
          If a counselor, teacher, or nonprofit gave you an invite code, enter it here. They will only ever see group totals, never your profile, your matches, or your messages.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {joined ? (
          <p className="text-sm">You are part of <span className="font-semibold">{joined}</span>.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. RISE24"
              className="max-w-[220px] font-mono tracking-widest"
            />
            <Button onClick={redeem} disabled={busy || !code.trim()} variant="outline">
              {busy ? "Joining…" : "Join cohort"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Opt-in deadline digest by email. */
function NotificationCard() {
  const [enabled, setEnabled] = useState(false);
  const [frequency, setFrequency] = useState<"weekly" | "daily">("weekly");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("notification_preferences")
        .select("email_digest_enabled,frequency")
        .eq("user_id", u.user.id)
        .maybeSingle();
      setEnabled(!!data?.email_digest_enabled);
      if (data?.frequency === "daily" || data?.frequency === "weekly") setFrequency(data.frequency);
      setLoaded(true);
    })();
  }, []);

  const persist = async (next: { enabled?: boolean; frequency?: "weekly" | "daily" }) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("notification_preferences").upsert(
      {
        user_id: u.user.id,
        email_digest_enabled: next.enabled ?? enabled,
        frequency: next.frequency ?? frequency,
      },
      { onConflict: "user_id" },
    );
    if (error) toast.error(error.message);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deadline reminders</CardTitle>
        <p className="text-sm text-muted-foreground pt-1">
          A short email with your strongest new matches and anything closing in the next two weeks. Deadlines are the quietest way to lose an opportunity you already qualified for.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="digest">Email me a digest</Label>
          <Switch
            id="digest"
            checked={enabled}
            disabled={!loaded}
            onCheckedChange={(v) => { setEnabled(v); persist({ enabled: v }); }}
          />
        </div>
        {enabled && (
          <div className="flex flex-wrap gap-2">
            {(["weekly", "daily"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => { setFrequency(f); persist({ frequency: f }); }}
                className={
                  "rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors " +
                  (frequency === f
                    ? "bg-primary/10 text-primary ring-primary/30 hover:bg-primary/15"
                    : "bg-transparent text-muted-foreground ring-border hover:bg-muted")
                }
              >
                {f === "weekly" ? "Once a week" : "Every day"}
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function YesNoPicker({ value, onChange }: { value: boolean | null | undefined; onChange: (v: boolean | null) => void }) {
  const opts: Array<{ label: string; v: boolean | null }> = [
    { label: "Yes", v: true },
    { label: "No", v: false },
    { label: "Not sure yet", v: null },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {opts.map((o) => {
        const active = value === o.v || (value === undefined && o.v === null);
        return (
          <button
            key={o.label}
            type="button"
            onClick={() => onChange(o.v)}
            className={
              "rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors " +
              (active
                ? "bg-primary/10 text-primary ring-primary/30 hover:bg-primary/15"
                : "bg-transparent text-muted-foreground ring-border hover:bg-muted")
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const LANGUAGE_OPTIONS = [
  "Español", "Mandarin", "Cantonese", "Hindi", "French",
  "Vietnamese", "Tagalog", "Arabic",
] as const;

function LanguagePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (lang: string) => {
    onChange(value.includes(lang) ? value.filter((l) => l !== lang) : [...value, lang]);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {LANGUAGE_OPTIONS.map((lang) => {
        const active = value.includes(lang);
        return (
          <button
            key={lang}
            type="button"
            onClick={() => toggle(lang)}
            className={
              "rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors " +
              (active
                ? "bg-primary/10 text-primary ring-primary/30 hover:bg-primary/15"
                : "bg-transparent text-muted-foreground ring-border hover:bg-muted")
            }
          >
            {lang}
          </button>
        );
      })}
    </div>
  );
}
