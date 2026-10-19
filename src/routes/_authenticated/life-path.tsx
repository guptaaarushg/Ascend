import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { lifePathSimulate } from "@/lib/ascend.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HologramRoadmap } from "@/components/life-path/hologram-roadmap";


import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/life-path")({
  head: () => ({ meta: [
    { title: "Life Path Simulator | Ascend" },
    { name: "description", content: "Build and explore a personalized, interactive roadmap toward your education and career goals." },
    { property: "og:title", content: "Life Path Simulator | Ascend" },
    { property: "og:description", content: "Build and explore a personalized, interactive roadmap toward your education and career goals." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: LifePath,
});

type Milestone = {
  year: number;
  title: string;
  description: string;
  skills?: string[];
  opportunity_ids?: string[];
  resources?: string[];
  why_you?: string;
  action_steps?: string[];
  checkpoint?: string;
};
type Insights = { strengths?: string[]; gaps?: string[]; financial_strategy?: string } | null;
type Path = {
  name: string;
  summary: string;
  salary_range?: string;
  education_required?: string;
  skills?: string[];
  milestones: Milestone[];
};

function LifePath() {
  const run = useServerFn(lifePathSimulate);
  const [goal, setGoal] = useState("Physician");
  const [field, setField] = useState("Biology / Pre-Med");
  const [edu, setEdu] = useState("high_school");
  const [years, setYears] = useState(4);
  const [loading, setLoading] = useState(false);
  const [paths, setPaths] = useState<Path[]>([]);
  const [explanation, setExplanation] = useState("");
  const [insights, setInsights] = useState<Insights>(null);
  const [oppTitles, setOppTitles] = useState<Record<string, string>>({});
  const [view, setView] = useState<"3d" | "list">("3d");


  const simulate = async () => {
    if (!goal.trim() || !field.trim()) {
      toast.error("Add a career goal and field first.");
      return;
    }
    setLoading(true);
    try {
      const res = await run({ data: { career_goal: goal, field, education_level: edu, years } });
      const nextPaths = Array.isArray(res.paths) ? (res.paths as Path[]) : [];
      if (nextPaths.length === 0) {
        toast.error("The simulator did not return a roadmap. Please try again.");
        return;
      }
      setPaths(nextPaths);
      setExplanation(res.explanation);
      setInsights(("profile_insights" in res ? (res.profile_insights as Insights) : null) ?? null);
      setOppTitles(("opportunity_titles" in res ? (res.opportunity_titles as Record<string, string>) : {}) ?? {});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-7 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          
          <h1 className="text-3xl font-bold sm:text-4xl">Life Path Simulator</h1>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/export"> Export Report for Counselor</Link>
        </Button>
      </div>
      <p className="mb-7 max-w-2xl text-base leading-7 text-muted-foreground">Turn a goal into clear yearly steps, then rotate, zoom, and explore each possible path.</p>


      <Card className="mb-7 border-primary/15 bg-card shadow-sm">
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="life-goal">Career goal</Label>
            <Input id="life-goal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. Physician" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="life-field">Major / field</Label>
            <Input id="life-field" value={field} onChange={(e) => setField(e.target.value)} placeholder="e.g. Biology" />
          </div>
          <div className="space-y-1.5">
            <Label id="education-label">Education level</Label>
            <Select value={edu} onValueChange={setEdu}>
              <SelectTrigger aria-labelledby="education-label"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="middle_school">Middle School</SelectItem>
                <SelectItem value="high_school">High School</SelectItem>
                <SelectItem value="undergraduate">Undergraduate</SelectItem>
                <SelectItem value="graduate">Graduate</SelectItem>
                <SelectItem value="career_change">Career Change</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="life-years">Time horizon (years)</Label>
            <Input id="life-years" type="number" min={1} max={10} value={years} onChange={(e) => setYears(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} />
          </div>
          <Button onClick={simulate} disabled={loading} className="h-10">
            
            {loading ? "Reading your profile and building your paths (up to a minute)..." : "Simulate paths"}
          </Button>
        </CardContent>
      </Card>

      {paths.length === 0 ? (
        <Card className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]">
            <svg viewBox="0 0 600 280" className="size-full" preserveAspectRatio="xMidYMid slice">
              <defs>
                <marker id="lp-arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
                </marker>
              </defs>
              <g stroke="currentColor" strokeWidth="2" fill="none" markerEnd="url(#lp-arr)">
                <path d="M40,140 C140,40 240,40 320,140 S500,240 560,140" />
                <path d="M40,200 C160,180 220,90 340,90" />
                <path d="M60,80 C180,120 260,220 420,200" />
              </g>
              <g fill="currentColor">
                <circle cx="40" cy="140" r="8" />
                <circle cx="200" cy="80" r="6" />
                <circle cx="320" cy="140" r="7" />
                <circle cx="440" cy="190" r="6" />
                <circle cx="560" cy="140" r="9" />
              </g>
              <g fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.6">
                <rect x="80" y="40" width="70" height="34" rx="6" />
                <rect x="260" y="30" width="90" height="34" rx="6" />
                <rect x="430" y="60" width="80" height="34" rx="6" />
                <rect x="150" y="210" width="80" height="34" rx="6" />
                <rect x="350" y="220" width="90" height="34" rx="6" />
              </g>
            </svg>
          </div>
          <CardContent className="relative py-16 text-center">
            
            <h3 className="text-lg font-semibold">Your roadmap starts here</h3>
            <p className="text-muted-foreground mt-1 max-w-md mx-auto">
              Pick a career goal above and click <span className="font-medium text-foreground">Simulate paths</span>. Ascend will sketch multiple year-by-year roadmaps tailored to your profile.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {explanation && (
            <Card className="mb-4 bg-primary/5 border-primary/20">
              <CardContent className="pt-6 text-sm"><span className="font-medium text-primary">Why these paths: </span>{explanation}</CardContent>
            </Card>
          )}
          {insights && ((insights.strengths?.length ?? 0) > 0 || (insights.gaps?.length ?? 0) > 0) && (
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <Card><CardContent className="pt-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">What you already bring</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">{insights.strengths?.map((x) => <li key={x}>{x}</li>)}</ul>
              </CardContent></Card>
              <Card><CardContent className="pt-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">Gaps to close</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">{insights.gaps?.map((x) => <li key={x}>{x}</li>)}</ul>
              </CardContent></Card>
              {insights.financial_strategy && (
                <Card><CardContent className="pt-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">Paying for it</p>
                  <p className="mt-2 text-sm">{insights.financial_strategy}</p>
                </CardContent></Card>
              )}
            </div>
          )}
          <Tabs defaultValue="0">
            <TabsList className="flex-wrap h-auto">
              {paths.map((p, i) => <TabsTrigger key={i} value={String(i)}>{p.name}</TabsTrigger>)}
            </TabsList>
            {paths.map((p, i) => (
              <TabsContent key={i} value={String(i)} className="mt-4 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">{p.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{p.summary}</p>
                  </CardHeader>
                  <CardContent className="grid sm:grid-cols-3 gap-3 text-sm">
                    {p.salary_range && <Stat label="Salary range" value={p.salary_range} />}
                    {p.education_required && <Stat label="Education" value={p.education_required} />}
                    {p.skills && p.skills.length > 0 && <Stat label="Core skills" value={p.skills.slice(0, 5).join(", ")} />}
                  </CardContent>

                </Card>

                <div className="flex items-center gap-2">
                  <Button size="sm" variant={view === "3d" ? "default" : "outline"} onClick={() => setView("3d")}>
                    3D hologram
                  </Button>
                  <Button size="sm" variant={view === "list" ? "default" : "outline"} onClick={() => setView("list")}>
                    Timeline list
                  </Button>
                </div>

                {view === "3d" ? (
                  <HologramRoadmap milestones={p.milestones} opportunityTitles={oppTitles} />
                ) : (
                <div className="relative">
                  <div aria-hidden className="absolute left-6 top-2 bottom-2 w-px bg-primary/25" />
                  <ol className="space-y-5">
                    {p.milestones.map((m, idx) => {
                      const pct = Math.round(((idx + 1) / p.milestones.length) * 100);
                      return (
                        <li key={idx} className="relative pl-16 animate-fade-in" style={{ animationDelay: `${idx * 80}ms`, animationFillMode: "backwards" }}>
                          <div className="absolute left-0 top-0 flex flex-col items-center">
                            <div className="relative">
                              <div className="relative size-12 rounded-full bg-primary text-primary-foreground flex flex-col items-center justify-center leading-none ring-4 ring-background">
                                <span className="text-[9px] uppercase tracking-wider opacity-80">Yr</span>
                                <span className="text-sm font-bold">{m.year}</span>
                              </div>
                            </div>
                          </div>
                          <div aria-hidden className="absolute left-12 top-5 h-px w-4 bg-primary/40" />

                          <Card className="hover:-translate-y-0.5 transition-transform">
                            <CardContent className="pt-5">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-[11px] uppercase tracking-wider text-primary font-semibold">Milestone {String(idx + 1).padStart(2, "0")} · Year {m.year}</div>
                                  <h3 className="font-semibold mt-0.5 text-base">{m.title}</h3>
                                </div>
                                <Badge variant="outline" className="shrink-0 text-[10px] border-primary/30 text-primary">
                                  {pct}% complete
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-2">{m.description}</p>
                              {m.why_you && <p className="mt-2 rounded-lg bg-primary/5 p-3 text-sm"><span className="font-medium text-primary">Why this fits you: </span>{m.why_you}</p>}
                              {m.action_steps && m.action_steps.length > 0 && (
                                <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">{m.action_steps.map((a) => <li key={a}>{a}</li>)}</ol>
                              )}
                              {m.checkpoint && <p className="mt-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">You are on track if: </span>{m.checkpoint}</p>}
                              <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                              </div>
                              {m.skills && m.skills.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                  {m.skills.map((s) => <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>)}
                                </div>
                              )}
                              {m.resources && m.resources.length > 0 && (
                                <div className="mt-2 text-xs text-muted-foreground">
                                  <span className="font-medium">Resources: </span>{m.resources.join(" · ")}
                                </div>
                              )}
                              {m.opportunity_ids && m.opportunity_ids.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                  {m.opportunity_ids.map((id) => (
                                    <Button key={id} asChild size="sm" variant="outline" className="h-7 text-xs">
                                      <Link to="/opportunity/$id" params={{ id }}>{oppTitles[id] ?? "Open opportunity"}</Link>
                                    </Button>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </li>
                      );
                    })}
                  </ol>
                </div>
                )}



              </TabsContent>
            ))}
          </Tabs>
          <p className="text-xs text-muted-foreground mt-6">These pathways are estimates based on your profile and goal. Explore them as starting points, not guarantees.</p>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

