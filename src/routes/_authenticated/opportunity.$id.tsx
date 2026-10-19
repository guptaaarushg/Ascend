import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { assistantChat, acceptanceAnalysis, translateOpportunity } from "@/lib/ascend.functions";
import { normalizeOpportunityValue, formatOpportunityValue } from "@/lib/opportunity-value";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarrierRow } from "@/components/opportunity/barrier-row";
import { Progress } from "@/components/ui/progress";
import { categoryLabel } from "@/lib/categories";
import { ArrowLeft, CalendarDays, DollarSign, ExternalLink, MapPin, Send, MessageSquare, Bookmark, CheckCircle2, Sparkles, TrendingUp, AlertTriangle, CheckCircle, ListChecks } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

export const Route = createFileRoute("/_authenticated/opportunity/$id")({
  component: OpportunityDetail,
});

type Opportunity = {
  id: string; title: string; organization: string; category: string;
  description: string; eligibility: string; deadline: string | null;
  location: string | null; remote: boolean; value_usd: number | null;
  url: string | null; tags: string[]; related_skills: string[];
  pathway_unlocks: string[]; competitiveness: string | null; underrepresented: boolean;
};

function OpportunityDetail() {
  const { id } = Route.useParams();
  const [opp, setOpp] = useState<Opportunity | null>(null);
  const [match, setMatch] = useState<{ score: number; reasoning: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
    const { data: s } = await supabase.auth.getSession();
    const u = { user: s.session?.user };
    if (!u.user) return;
    const [{ data: o }, { data: m }, { data: us }] = await Promise.all([
      supabase.from("opportunities").select("*").eq("id", id).maybeSingle(),
      supabase.from("matches").select("score,reasoning").eq("user_id", u.user.id).eq("opportunity_id", id).maybeSingle(),
      supabase.from("user_opportunities").select("status").eq("user_id", u.user.id).eq("opportunity_id", id).maybeSingle(),
    ]);
    setOpp(o as Opportunity | null);
    setMatch(m);
    setStatus(us?.status ?? null);
    } catch {
      toast.error("Couldn't load this opportunity. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [id]);

  const setStat = async (newStatus: "saved" | "applied" | "accepted") => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("user_opportunities").upsert({
      user_id: u.user.id, opportunity_id: id, status: newStatus,
    }, { onConflict: "user_id,opportunity_id" });
    if (error) toast.error(error.message);
    else { setStatus(newStatus); toast.success(`Marked as ${newStatus}`); }
  };

  if (loading) return <div className="container mx-auto max-w-4xl px-4 py-10"><div className="h-96 rounded-xl bg-muted animate-pulse" /></div>;
  if (!opp) return <div className="container mx-auto max-w-4xl px-4 py-10 text-center"><p className="text-lg font-semibold">We couldn't find this opportunity.</p><p className="mt-2 text-muted-foreground">It may have closed or been removed.</p><Link to="/feed" className="mt-4 inline-block underline">Back to your feed</Link></div>;

  const daysToDeadline = opp.deadline ? Math.ceil((new Date(opp.deadline).getTime() - Date.now()) / 86400000) : null;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <Link to="/feed" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="size-3.5" /> Back to feed
      </Link>

      <div className="rounded-2xl p-6 sm:p-8 bg-primary text-primary-foreground">
        <div className="flex items-center gap-2 text-sm opacity-90">
          {categoryLabel(opp.category)} · {opp.organization}
        </div>
        <h1 className="mt-2 text-3xl sm:text-4xl font-bold leading-tight">{opp.title}</h1>
        <div className="mt-4 flex flex-wrap gap-4 text-sm opacity-95">
          <span className="flex items-center gap-1.5"><CalendarDays className="size-4" />{opp.deadline ? <>Due {new Date(opp.deadline).toLocaleDateString()}{daysToDeadline !== null && daysToDeadline >= 0 && ` · ${daysToDeadline} days`}</> : "Deadline not listed, check the program site"}</span>
          {opp.location && <span className="flex items-center gap-1.5"><MapPin className="size-4" />{opp.location}{opp.remote && " (remote)"}</span>}
          {(() => {
            const v = normalizeOpportunityValue(opp.value_usd, opp.description);
            return v ? (
              <span className="flex items-center gap-1.5" title={v.label}>
                <DollarSign className="size-4" />{formatOpportunityValue(v)}
              </span>
            ) : null;
          })()}
        </div>
        {match && (
          <div className="mt-5 inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-white/15 backdrop-blur border border-white/20">
            <div className="text-3xl font-bold">{match.score}</div>
            <div className="text-sm max-w-md opacity-95"><div className="font-medium">Match score</div><div className="opacity-90">{match.reasoning}</div></div>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2 space-y-4">
          <Tabs defaultValue="about">
            <TabsList>
              <TabsTrigger value="about">About</TabsTrigger>
              <TabsTrigger value="probability">Acceptance Probability</TabsTrigger>
              <TabsTrigger value="eligibility">Eligibility</TabsTrigger>
              <TabsTrigger value="assistant">Ascend Assistant</TabsTrigger>
            </TabsList>
            <TabsContent value="about" className="space-y-4 mt-4">
              <Card><CardContent className="pt-6 prose prose-sm dark:prose-invert max-w-none">
                <p>{opp.description}</p>
                {opp.url && <p><a href={opp.url} target="_blank" rel="noopener noreferrer" className="text-primary inline-flex items-center gap-1">Official page <ExternalLink className="size-3.5" /></a></p>}
                {opp.url && (() => {
                  let host = "";
                  try { host = new URL(opp.url).hostname.replace(/^www\./, ""); } catch { host = ""; }
                  const now = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
                  return host ? (
                    <p className="not-prose text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                      <CheckCircle2 className="size-3.5 text-success" />
                      Source verified via <span className="font-medium">{host}</span> · last checked {now}
                    </p>
                  ) : null;
                })()}
                <div className="not-prose"><BarrierRow opportunity={opp as any} /></div>
              </CardContent></Card>
              <TranslateCard opportunityId={opp.id} />
              {opp.pathway_unlocks?.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">This unlocks</CardTitle></CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {opp.pathway_unlocks.map((p) => <Badge key={p} variant="secondary">{p}</Badge>)}
                  </CardContent>
                </Card>
              )}
              {opp.tags?.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Tags</CardTitle></CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {opp.tags.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            <TabsContent value="eligibility" className="mt-4">
              <Card><CardContent className="pt-6 space-y-3">
                <h3 className="font-semibold">Who qualifies</h3>
                <p className="text-sm text-muted-foreground">{opp.eligibility}</p>
                {opp.related_skills?.length > 0 && (
                  <>
                    <h3 className="font-semibold pt-3">Helpful skills</h3>
                    <div className="flex flex-wrap gap-2">{opp.related_skills.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}</div>
                  </>
                )}
                {opp.competitiveness && <p className="text-xs pt-3 text-muted-foreground">Competitiveness: <span className="capitalize font-medium">{opp.competitiveness}</span></p>}
              </CardContent></Card>
            </TabsContent>
            <TabsContent value="probability" className="mt-4">
              <AcceptanceProbability opportunityId={opp.id} />
            </TabsContent>
            <TabsContent value="assistant" className="mt-4">
              <Assistant opportunityId={opp.id} />
            </TabsContent>
          </Tabs>
        </div>
        <div className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Track this</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Button onClick={() => setStat("saved")} variant={status === "saved" ? "default" : "outline"} className="w-full justify-start">
                <Bookmark className="size-4 mr-2" /> {status === "saved" ? "Saved" : "Save"}
              </Button>
              <Button onClick={() => setStat("applied")} variant={status === "applied" ? "default" : "outline"} className="w-full justify-start">
                <Send className="size-4 mr-2" /> {status === "applied" ? "Applied" : "Mark applied"}
              </Button>
              <Button onClick={() => setStat("accepted")} variant={status === "accepted" ? "default" : "outline"} className="w-full justify-start">
                <CheckCircle2 className="size-4 mr-2" /> {status === "accepted" ? "Accepted" : "Mark accepted"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Assistant({ opportunityId }: { opportunityId: string }) {
  const chat = useServerFn(assistantChat);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    { role: "assistant", content: "Hi! I'm your Ascend Assistant. Ask me to draft an essay, build a timeline from the deadline, check eligibility, or generate an application checklist." },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: 9e9 }); }, [messages]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const res = await chat({ data: { opportunityId, messages: next } });
      setMessages([...next, { role: "assistant", content: res.content }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Assistant failed");
    } finally {
      setSending(false);
    }
  };

  const quick = [
    "Build me a checklist with timeline",
    "Draft a 500-word personal statement based on my profile",
    "What am I missing to qualify?",
  ];

  return (
    <Card className="flex flex-col h-[600px]">
      <CardHeader className="border-b">
        <CardTitle className="text-base flex items-center gap-2"><MessageSquare className="size-4 text-primary" /> Ascend Assistant</CardTitle>
      </CardHeader>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_h3]:mt-2 [&_h3]:mb-1"><ReactMarkdown>{m.content}</ReactMarkdown></div>
            </div>
          </div>
        ))}
        {sending && <div className="text-xs text-muted-foreground">Thinking…</div>}
      </div>
      <div className="border-t p-3 space-y-2">
        {messages.length === 1 && (
          <div className="flex flex-wrap gap-1.5">
            {quick.map((q) => <Button key={q} size="sm" variant="outline" onClick={() => send(q)}>{q}</Button>)}
          </div>
        )}
        <div className="flex gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Ask anything about this opportunity…" />
          <Button onClick={() => send()} disabled={sending || !input.trim()}><Send className="size-4" /></Button>
        </div>
      </div>
    </Card>
  );
}

function AcceptanceProbability({ opportunityId }: { opportunityId: string }) {
  const run = useServerFn(acceptanceAnalysis);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    probability: number;
    potential_probability: number;
    confidence: "low" | "medium" | "high";
    strengths: string[];
    weaknesses: string[];
    action_plan: { action: string; impact: string }[];
    summary: string;
    completeness: number;
    match_score: number | null;
  } | null>(null);

  const analyze = async () => {
    setLoading(true);
    try {
      const res = await run({ data: { opportunityId } });
      setData(res as any);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  if (!data) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <h3 className="font-semibold">Estimate your acceptance probability</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            We'll combine your profile, eligibility fit, and competitiveness to estimate your odds, plus an action plan to improve them.
          </p>
          <Button onClick={analyze} disabled={loading} className="mt-4">
            {loading ? "Analyzing…" : "Run analysis"}
          </Button>
        </CardContent>
      </Card>
    );
  }


  const confidenceColor =
    data.confidence === "high" ? "text-success" : data.confidence === "medium" ? "text-primary" : "text-muted-foreground";

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="grid sm:grid-cols-3 gap-4">
            <Metric label="Match Score" value={data.match_score !== null ? `${data.match_score}/100` : ", "} accent="primary" />
            <Metric label="Acceptance Probability" value={`${data.probability}%`} accent="success" />
            <Metric label="Confidence" value={data.confidence.toUpperCase()} accentClass={confidenceColor} />
          </div>
          {data.summary && <p className="mt-4 text-sm text-muted-foreground">{data.summary}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="size-4 text-primary" /> Probability projection</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Current</span>
              <span className="font-medium">{data.probability}%</span>
            </div>
            <Progress value={data.probability} />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Potential after action plan</span>
              <span className="font-medium text-success">{data.potential_probability}%</span>
            </div>
            <Progress value={data.potential_probability} className="[&>div]:bg-success" />
          </div>
          <p className="text-sm">
            Increase probability from <span className="font-semibold">{data.probability}%</span> to approximately{" "}
            <span className="font-semibold text-success">{data.potential_probability}%</span> by completing the actions below.
          </p>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><CheckCircle className="size-4 text-success" /> Strengths</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {data.strengths.map((s, i) => <li key={i} className="flex gap-2"><span className="text-success">✓</span>{s}</li>)}
              {data.strengths.length === 0 && <li className="text-muted-foreground text-xs">No strong signals yet. Complete your profile to surface more.</li>}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="size-4 text-warning" /> Weaknesses</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {data.weaknesses.map((w, i) => <li key={i} className="flex gap-2"><span className="text-warning">!</span>{w}</li>)}
              {data.weaknesses.length === 0 && <li className="text-muted-foreground text-xs">No major gaps detected.</li>}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ListChecks className="size-4 text-primary" /> Action plan</CardTitle></CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {data.action_plan.map((a, i) => (
              <li key={i} className="flex gap-3">
                <div className="size-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</div>
                <div>
                  <div className="font-medium text-sm">{a.action}</div>
                  <div className="text-xs text-muted-foreground">{a.impact}</div>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground italic">
        Predictions are estimates based on your profile and known program characteristics. They do not guarantee acceptance.
        Profile completeness: {data.completeness}%. Fill out more of your profile for higher-confidence estimates.
      </p>

      <Button onClick={analyze} disabled={loading} variant="outline" size="sm">
        {loading ? "Re-analyzing…" : "Re-run analysis"}
      </Button>
    </div>
  );
}

function Metric({ label, value, accent, accentClass }: { label: string; value: string; accent?: "primary" | "success"; accentClass?: string }) {
  const cls = accentClass ?? (accent === "primary" ? "text-primary" : accent === "success" ? "text-success" : "text-foreground");
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${cls}`}>{value}</div>
    </div>
  );
}

const LANGUAGES = [
  { id: "es", label: "Español", locale: "es-ES" },
  { id: "zh-Hans", label: "中文 (普通话)", locale: "zh-CN" },
  { id: "zh-Hant", label: "中文 (粵語)", locale: "zh-HK" },
  { id: "hi", label: "हिन्दी", locale: "hi-IN" },
  { id: "fr", label: "Français", locale: "fr-FR" },
  { id: "vi", label: "Tiếng Việt", locale: "vi-VN" },
  { id: "tl", label: "Tagalog", locale: "fil-PH" },
  { id: "ar", label: "العربية", locale: "ar-SA" },
  { id: "ko", label: "한국어", locale: "ko-KR" },
] as const;

/**
 * Read the parent note aloud in the family's language. Some parents read very
 * little even in their first language, so text alone is not enough.
 */
function ListenButton({ text, locale }: { text: string; locale: string }) {
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  if (!supported) return null;

  const toggle = () => {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = locale;
    const voice = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith(locale.slice(0, 2).toLowerCase()));
    if (voice) utter.voice = voice;
    utter.rate = 0.95;
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(utter);
  };

  return (
    <Button type="button" size="sm" variant="outline" onClick={toggle}>
      {speaking ? "Stop" : "Listen"}
    </Button>
  );
}

function TranslateCard({ opportunityId }: { opportunityId: string }) {
  const run = useServerFn(translateOpportunity);
  const [lang, setLang] = useState<typeof LANGUAGES[number]["id"]>("es");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ title: string; description: string; eligibility: string; parent_note: string } | null>(null);

  const translate = async () => {
    setLoading(true);
    try {
      const res = await run({ data: { opportunityId, language: lang } });
      setResult(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Translation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Translate for my family</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={lang} onValueChange={(v) => setLang(v as any)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={translate} disabled={loading} size="sm">
            {loading ? "Translating…" : "Translate"}
          </Button>
        </div>
        {result && (
          <div className="rounded-md border p-4 space-y-3 text-sm" lang={lang}>
            <div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Note for your family</div>
                <ListenButton
                  text={result.parent_note}
                  locale={LANGUAGES.find((l) => l.id === lang)?.locale ?? "en-US"}
                />
              </div>
              <p className="italic" dir={lang === "ar" ? "rtl" : undefined}>{result.parent_note}</p>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Title</div>
              <p className="font-semibold">{result.title}</p>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Description</div>
              <p>{result.description}</p>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Who qualifies</div>
              <p>{result.eligibility}</p>
            </div>
            <p className="text-xs text-muted-foreground italic">AI-translated. Double-check key details against the official page.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
