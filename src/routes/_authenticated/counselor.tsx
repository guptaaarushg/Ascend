import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { containsProfanity, FAMILY_FRIENDLY_MESSAGE } from "@/lib/profanity";
import { cohortNameSchema, firstError } from "@/lib/validation";


export const Route = createFileRoute("/_authenticated/counselor")({
  head: () => ({
    meta: [
      { title: "Cohort dashboard, Ascend" },
      { name: "description", content: "Invite a cohort of students to Ascend and see anonymized group progress, never individual student data." },
      { property: "og:title", content: "Cohort dashboard, Ascend" },
      { property: "og:description", content: "Anonymized cohort progress for counselors and nonprofits using Ascend." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CounselorPage,
});

type Cohort = { id: string; name: string; invite_code: string; created_at: string };
type Stats = {
  students_onboarded: number;
  strong_matches: number;
  deadlines_this_week: number;
  zero_barrier_users: number;
};

function newCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function CounselorPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [stats, setStats] = useState<Record<string, Stats>>({});
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
    const ok = !!roles?.some((r) => r.role === "counselor" || r.role === "admin");
    setAllowed(ok);
    if (!ok) return;

    const { data } = await supabase
      .from("cohorts")
      .select("id,name,invite_code,created_at")
      .order("created_at", { ascending: false });
    const list = (data ?? []) as Cohort[];
    setCohorts(list);

    const entries = await Promise.all(
      list.map(async (c) => {
        const { data: s } = await supabase.rpc("counselor_cohort_stats", { _cohort_id: c.id });
        const row = Array.isArray(s) ? s[0] : null;
        return [c.id, (row ?? { students_onboarded: 0, strong_matches: 0, deadlines_this_week: 0, zero_barrier_users: 0 }) as Stats] as const;
      }),
    );
    setStats(Object.fromEntries(entries));
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    const parsed = cohortNameSchema.safeParse(name);
    if (!parsed.success) { toast.error(firstError(parsed.error)); return; }
    const cleanName = parsed.data as string;
    if (containsProfanity(cleanName)) { toast.error(FAMILY_FRIENDLY_MESSAGE); return; }
    setCreating(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("cohorts").insert({
        counselor_id: u.user.id,
        name: cleanName,
        invite_code: newCode(),
      });
      if (error) throw error;

      setName("");
      toast.success("Cohort created. Share the code with your students.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create that cohort");
    } finally {
      setCreating(false);
    }
  };

  if (allowed === null) {
    return <div className="container mx-auto max-w-4xl px-4 py-8"><div className="h-64 rounded-xl bg-muted animate-pulse" /></div>;
  }

  if (!allowed) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16">
        <Card>
          <CardContent className="text-center py-12">
            <h1 className="text-xl font-semibold">Counselors and program staff only</h1>
            <p className="text-muted-foreground mt-2">
              If you run a school program or nonprofit and want a cohort here, reach out and we will set your account up.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cohort dashboard</h1>
        <p className="text-muted-foreground mt-1">
          You see group totals only. Student profiles, matches, messages, and names stay private, including from you.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Create a cohort</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cohort-name">Cohort name</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="cohort-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Lincoln High Class of 2027"
                className="max-w-sm"
              />
              <Button onClick={create} disabled={creating || !name.trim()}>
                {creating ? "Creating…" : "Create cohort"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {cohorts.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <h3 className="font-semibold">No cohorts yet</h3>
            <p className="text-muted-foreground mt-1 max-w-md mx-auto">
              Create one, hand the code to your students, and their progress rolls up here as anonymized totals.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {cohorts.map((c) => {
            const s = stats[c.id];
            return (
              <Card key={c.id}>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold leading-tight">{c.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Invite code{" "}
                        <span className="font-mono font-semibold tracking-widest text-primary">{c.invite_code}</span>
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard?.writeText(c.invite_code);
                        toast.success("Code copied");
                      }}
                    >
                      Copy code
                    </Button>
                  </div>
                  <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Tile label="Students onboarded" value={s?.students_onboarded ?? 0} />
                    <Tile label="Matches at 85+" value={s?.strong_matches ?? 0} accent />
                    <Tile label="Deadlines this week" value={s?.deadlines_this_week ?? 0} />
                    <Tile label="Using $0-barrier" value={s?.zero_barrier_users ?? 0} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Counts under a handful of students are still group totals and never identify anyone. Ascend does not give counselors access to student rows.
      </p>
    </div>
  );
}

function Tile({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-3 text-center ${accent ? "border-primary/25 bg-primary/5 text-primary" : "border-border bg-card"}`}>
      <div className="text-2xl font-bold tabular-nums leading-tight">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
