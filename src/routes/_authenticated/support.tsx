import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { discoverOpportunities } from "@/lib/ascend.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { categoryLabel } from "@/lib/categories";

import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({ meta: [{ title: "Support for students who need it most, Ascend" }] }),
  component: SupportPage,
});

type Resource = {
  title: string;
  org: string;
  desc: string;
  url: string;
  badge: string;
                                                       
  tags: Array<
    | "always"
    | "low_income"
    | "first_gen"
    | "middle_school"
    | "high_school"
    | "senior"
    | "college"
    | "stem"
    | "minority"
    | "test_prep"
    | "counseling"
    | "housing_food"
  >;
};

const RESOURCES: Resource[] = [
  {
    title: "FAFSA, Free Application for Federal Student Aid",
    org: "U.S. Department of Education",
    desc: "The single most important form for unlocking Pell Grants (up to $7,395/yr, free money), federal work-study, and subsidized loans. Required by almost every U.S. college for need-based aid.",
    url: "https://studentaid.gov/h/apply-for-aid/fafsa",
    badge: "Start here",
    tags: ["always", "low_income", "senior", "college"],
  },
  {
    title: "QuestBridge National College Match",
    org: "QuestBridge",
    desc: "Full 4-year scholarships (tuition + room + board, ~$300k+ value) to 50+ top colleges (Stanford, MIT, Yale, Princeton) for high-achieving low-income students. Application fee waived.",
    url: "https://www.questbridge.org/",
    badge: "Life-changing",
    tags: ["low_income", "first_gen", "senior", "high_school"],
  },
  {
    title: "Posse Foundation Scholarship",
    org: "Posse",
    desc: "Full 4-year tuition scholarship to 60+ partner colleges. Selects students from urban public schools who may be overlooked by traditional admissions.",
    url: "https://www.possefoundation.org/",
    badge: "Full ride",
    tags: ["low_income", "senior", "high_school", "minority"],
  },
  {
    title: "Common App Fee Waiver",
    org: "The Common Application",
    desc: "If you qualify for free/reduced lunch, are a ward of the state, or your family receives public assistance, you can apply to dozens of colleges for free. Just check the box.",
    url: "https://www.commonapp.org/apply/fee-waivers",
    badge: "Free applications",
    tags: ["low_income", "senior", "high_school"],
  },
  {
    title: "Khan Academy Official SAT Prep",
    org: "Khan Academy + College Board",
    desc: "100% free, personalized SAT/PSAT/Digital SAT prep. Equivalent to private tutoring that costs $100+/hr.",
    url: "https://www.khanacademy.org/digital-sat",
    badge: "Free",
    tags: ["always", "test_prep", "high_school"],
  },
  {
    title: "MATCH Beyond / College Possible",
    org: "College Possible",
    desc: "Free virtual college coaching for low-income students, application help, essay review, financial aid, and persistence support through graduation.",
    url: "https://www.collegepossible.org/",
    badge: "Free counseling",
    tags: ["low_income", "first_gen", "counseling", "high_school", "senior"],
  },
  {
    title: "Jack Kent Cooke Foundation Scholarship",
    org: "Jack Kent Cooke Foundation",
    desc: "Up to $55,000/year for high-achieving students with financial need, for college, graduate school, and beyond. One of the largest private scholarships in the country.",
    url: "https://www.jkcf.org/our-scholarships/college-scholarship-program/",
    badge: "Up to $55k/yr",
    tags: ["low_income", "senior", "high_school", "college"],
  },
  {
    title: "Gates Scholarship",
    org: "Bill & Melinda Gates Foundation",
    desc: "Full cost of attendance scholarship for outstanding minority high school seniors from Pell-eligible households. Covers everything not paid by other aid.",
    url: "https://www.thegatesscholarship.org/",
    badge: "Full cost",
    tags: ["low_income", "minority", "senior", "high_school"],
  },
  {
    title: "MIT THINK / RSI / MITES",
    org: "MIT",
    desc: "Tuition-free summer STEM programs for high schoolers. MITES Summer in particular targets students from underrepresented backgrounds, including low-income.",
    url: "https://oeop.mit.edu/programs/mites",
    badge: "Free STEM summer",
    tags: ["stem", "high_school", "low_income", "minority"],
  },
  {
    title: "Cooke Young Scholars (8th graders)",
    org: "Jack Kent Cooke Foundation",
    desc: "5-year college prep program for high-achieving 8th graders with financial need. Personal advisor, summer programs, academic enrichment, all funded.",
    url: "https://www.jkcf.org/our-scholarships/young-scholars-program/",
    badge: "Middle school",
    tags: ["middle_school", "low_income"],
  },
  {
    title: "EITC, Earned Income Tax Credit",
    org: "IRS",
    desc: "If you or your family work, you may be owed thousands back at tax time. Up to $7,830 for families with kids. Many people who qualify never claim it.",
    url: "https://www.irs.gov/credits-deductions/individuals/earned-income-tax-credit-eitc",
    badge: "Get money back",
    tags: ["low_income", "always"],
  },
  {
    title: "211.org, Local Help",
    org: "United Way",
    desc: "Call or text 211 to find local food, housing, utility help, mental health, and family services anywhere in the U.S. Free, confidential, 24/7.",
    url: "https://www.211.org/",
    badge: "Local resources",
    tags: ["always", "housing_food", "low_income"],
  },
];

type ProfileLite = {
  display_name: string | null;
  education_level: string | null;
  academic_interests: string[] | null;
  career_interests: string[] | null;
  certifications: string[] | null;
  socioeconomic_info: string | null;
  languages: string[] | null;
};

function tierFromProfile(p: ProfileLite | null): "low" | "middle" | "high" | "unknown" {
  const s = `${p?.socioeconomic_info ?? ""}`.toLowerCase();
  if (!s.trim()) return "unknown";
  if (/(low[- ]?income|first[- ]?gen|free.{0,8}(lunch|reduced)|pell|title\s?i|underserved|fafsa|need[- ]?based|poverty|underrepresented|foster|single[- ]?parent|undocumented|refugee|homeless)/.test(s)) return "low";
  if (/(high[- ]?income|upper[- ]?middle|affluent|private school|wealthy|well[- ]?off)/.test(s)) return "high";
  return "middle";
}

function detectGradeTag(p: ProfileLite | null): Resource["tags"][number] | null {
  const s = `${p?.education_level ?? ""}`.toLowerCase();
  if (!s) return null;
  if (/(middle|6th|7th|8th|junior high)/.test(s)) return "middle_school";
  if (/(senior|12th|grade 12)/.test(s)) return "senior";
  if (/(high school|9th|10th|11th|freshman|sophomore|junior)/.test(s)) return "high_school";
  if (/(college|undergrad|university|freshman.*college)/.test(s)) return "college";
  return null;
}

function isStem(p: ProfileLite | null): boolean {
  const words = [
    ...(p?.academic_interests ?? []),
    ...(p?.career_interests ?? []),
  ].join(" ").toLowerCase();
  return /(math|science|biology|chem|physic|engineer|computer|coding|program|robot|ai|data|medic|neuro|astronomy|technology|stem)/.test(words);
}

function firstName(p: ProfileLite | null, fallback = ""): string {
  const n = (p?.display_name ?? fallback).trim();
  return n.split(/\s+/)[0] ?? "";
}

function scoreResource(r: Resource, profileTags: Set<string>): number {
  if (r.tags.includes("always")) return r.tags.filter((t) => profileTags.has(t)).length + 1;
  const overlap = r.tags.filter((t) => profileTags.has(t)).length;
  return overlap;
}

function SupportPage() {
  const discover = useServerFn(discoverOpportunities);
  const [discovering, setDiscovering] = useState(false);
  const [personal, setPersonal] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileLite | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setLoading(false); return; }

    const [{ data: prof }, { data: matched }, { data: underrep }] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name,education_level,academic_interests,career_interests,certifications,socioeconomic_info,languages")
        .eq("id", u.user.id)
        .maybeSingle(),
      supabase
        .from("matches")
        .select("score,opportunity:opportunities(id,title,organization,category,description,value_usd,url,underrepresented,deadline)")
        .eq("user_id", u.user.id)
        .gte("score", 70)
        .order("score", { ascending: false })
        .limit(30),
      supabase
        .from("opportunities")
        .select("id,title,organization,category,description,value_usd,url,underrepresented,deadline")
        .eq("underrepresented", true)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    setProfile(prof as ProfileLite | null);

                                                                                         
    const matchedUnderrep = (matched ?? [])
      .map((m: any) => m.opportunity)
      .filter((o: any) => o && o.underrepresented);
    const combined = [
      ...matchedUnderrep,
      ...(underrep ?? []).filter((o: any) => !matchedUnderrep.some((mo: any) => mo.id === o.id)),
    ];
    setPersonal(combined.slice(0, 12));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const runDiscover = async () => {
    setDiscovering(true);
    try {
      const res = await discover({ data: { focus: "low_income" } });
      toast.success(res.discovered ? `Found ${res.discovered} new opportunities` : (res.message ?? "Done"));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Discovery failed");
    } finally {
      setDiscovering(false);
    }
  };

  const tier = tierFromProfile(profile);
  const gradeTag = detectGradeTag(profile);
  const stem = isStem(profile);
  const name = firstName(profile);

  const profileTags = useMemo(() => {
    const t = new Set<string>();
    if (tier === "low") { t.add("low_income"); t.add("first_gen"); }
    if (gradeTag) t.add(gradeTag);
    if (stem) t.add("stem");
                                                   
    if (gradeTag === "high_school" || gradeTag === "senior") t.add("test_prep");
    return t;
  }, [tier, gradeTag, stem]);

  const sortedResources = useMemo(() => {
    return [...RESOURCES]
      .map((r) => ({ r, s: scoreResource(r, profileTags) }))
                                                               
      .filter(({ r, s }) => s > 0 || r.tags.includes("always"))
      .sort((a, b) => b.s - a.s)
      .map(({ r }) => r);
  }, [profileTags]);

  const topInterests = [
    ...(profile?.career_interests ?? []),
    ...(profile?.academic_interests ?? []),
  ].slice(0, 3);

  const personalizedBlurbs: string[] = [];
  if (tier === "low") personalizedBlurbs.push("need-based scholarships and fee waivers");
  if (gradeTag === "middle_school") personalizedBlurbs.push("early college prep pipelines built for 8th graders");
  if (gradeTag === "senior") personalizedBlurbs.push("full-ride matches for graduating seniors");
  if (stem) personalizedBlurbs.push("free STEM summer programs");
  if (topInterests.length) personalizedBlurbs.push(`programs tied to ${topInterests.join(", ")}`);
  if (!personalizedBlurbs.length) personalizedBlurbs.push("free tools and need-based aid you can actually use");

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="rounded-2xl p-6 sm:p-8 mb-6 bg-primary text-primary-foreground">
        <div className="flex items-center gap-2 text-sm opacity-90"> Built for students without easy access</div>
        <h1 className="mt-2 text-3xl sm:text-4xl font-bold leading-tight">
          {name ? `${name}, your support hub` : "Support hub"}
        </h1>
        <p className="mt-2 text-sm sm:text-base opacity-95 max-w-2xl">
          Based on your profile{gradeTag ? ` (${gradeTag.replace("_", " ")})` : ""}{tier === "low" ? ", low-income context" : ""}{topInterests.length ? `, and interest in ${topInterests.slice(0, 2).join(" & ")}` : ""}, we've prioritized{" "}
          {personalizedBlurbs.slice(0, 3).join(", ")}. Everything below is free or need-based.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[...profileTags].map((t) => (
            <Badge key={t} variant="secondary" className="bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25 border-primary-foreground/20">
              {t.replace("_", " ")}
            </Badge>
          ))}
        </div>
      </div>

      <section className="mb-10">
        <div className="flex items-end justify-between mb-3">
          <div>
            <h2 className="text-xl font-semibold">Essential programs &amp; aid</h2>
            <p className="text-muted-foreground text-sm">Ordered by fit with your profile.</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {sortedResources.map((r) => (
            <Card key={r.url}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">{r.title}</CardTitle>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">{r.badge}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">{r.org}</div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground/90">{r.desc}</p>
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
                  Open 
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between mb-3 flex-wrap gap-2">
          <div>
            <h2 className="text-xl font-semibold">Personalized for you</h2>
            <p className="text-muted-foreground text-sm">
              Opportunities flagged for underrepresented and low-income students, ranked by your match score.
            </p>
          </div>
          <Button onClick={runDiscover} disabled={discovering} variant="outline">
            
            {discovering ? "Searching the web…" : "Find more for me"}
          </Button>
        </div>
        {loading ? (
          <div className="grid gap-3">{[1,2,3].map(i => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>
        ) : personal.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
            No personalized matches yet. Tap "Find more for me" to search the web.
          </CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {personal.map((o) => (
              <Card key={o.id}>
                <CardContent className="p-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground mb-1">{categoryLabel(o.category)} · {o.organization}</div>
                    <h3 className="font-semibold leading-tight">{o.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{o.description}</p>
                    {o.value_usd && <div className="text-xs mt-2 inline-flex items-center gap-1 text-success">{o.value_usd.toLocaleString()}</div>}
                  </div>
                  <Button asChild size="sm" variant="outline" className="shrink-0">
                    <Link to="/opportunity/$id" params={{ id: o.id }}>Open </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
