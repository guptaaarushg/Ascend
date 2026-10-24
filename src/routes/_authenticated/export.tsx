import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Mail, FileDown } from "lucide-react";
import { categoryLabel } from "@/lib/categories";
import { daysUntilDeadline, formatDeadline } from "@/lib/dates";

export const Route = createFileRoute("/_authenticated/export")({
  head: () => ({ meta: [{ title: "Counselor report, Ascend" }] }),
  component: ExportPage,
});

type Row = {
  score: number;
  reasoning: string;
  opportunity: {
    id: string; title: string; organization: string; category: string;
    description: string; deadline: string | null; location: string | null;
    value_usd: number | null; url: string | null;
  } | null;
};

type Profile = {
  display_name: string | null;
  education_level: string | null;
  location: string | null;
  long_term_goals: string | null;
  academic_interests: string[] | null;
  career_interests: string[] | null;
  extracurriculars: string[] | null;
  skills: string[] | null;
};

function ExportPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
      const { data: s } = await supabase.auth.getSession();
      const u = { user: s.session?.user };
      if (!u.user) return;
      const [{ data: p }, { data: m }] = await Promise.all([
        supabase.from("profiles")
          .select("display_name,education_level,location,long_term_goals,academic_interests,career_interests,extracurriculars,skills")
          .eq("id", u.user.id).maybeSingle(),
        supabase.from("matches")
          .select("score,reasoning,opportunity:opportunities(id,title,organization,category,description,deadline,location,value_usd,url)")
          .eq("user_id", u.user.id)
          .order("score", { ascending: false })
          .limit(15),
      ]);
      setProfile((p ?? null) as Profile | null);
      setName(p?.display_name ?? u.user.email ?? "Student");
      setRows((m ?? []) as unknown as Row[]);
      } catch {
        /* show the empty report instead of an endless loading state */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return rows
      .filter((r) => r.opportunity?.deadline)
      .map((r) => ({
        ...r,
        days: daysUntilDeadline(r.opportunity!.deadline!) ?? 0,
      }))
      .filter((r) => r.days >= 0)
      .sort((a, b) => a.days - b.days)
      .slice(0, 8);
  }, [rows]);

  const mailtoBody = encodeURIComponent(
    `Hi,\n\nI'd like to share the opportunities Ascend has matched for me. My top matches are below, please open the Ascend link beside each one for full details.\n\n` +
      rows
        .filter((r) => r.opportunity)
        .slice(0, 10)
        .map(
          (r, i) =>
            `${i + 1}. ${r.opportunity!.title}, ${r.opportunity!.organization}\n   Match: ${r.score}/100\n   ${r.opportunity!.deadline ? `Deadline: ${formatDeadline(r.opportunity!.deadline)}\n   ` : ""}${r.opportunity!.url ?? ""}`,
        )
        .join("\n\n") +
      `\n\nThank you,\n${name}`,
  );

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 print:py-0 print:max-w-none print:px-0">
      {/* Print-only tuning */}
      <style>{`
        @media print {
          @page { margin: 0.6in; }
          body { background: white; }
          .avoid-break { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-6 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link to="/feed"><ArrowLeft className="size-4 mr-1" /> Back to feed</Link>
        </Button>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <a href={`mailto:?subject=${encodeURIComponent("Counselor report from Ascend")}&body=${mailtoBody}`}>
              <Mail className="size-4 mr-1.5" /> Email counselor
            </a>
          </Button>
          <Button onClick={() => window.print()}>
            <FileDown className="size-4 mr-1.5" /> Export Report for Counselor
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Preparing report…</p>
      ) : (
        <article className="print:text-[11pt]">
          {/* Report header */}
          <header className="border-b-2 border-primary pb-4 mb-6 avoid-break">
            <div className="text-[11px] uppercase tracking-[0.2em] text-primary font-semibold">Ascend · Counselor Report</div>
            <h1 className="text-3xl font-bold mt-1">{name}</h1>
            <div className="mt-1 text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
              {profile?.education_level && <span>Education: <strong className="text-foreground/80">{humanize(profile.education_level)}</strong></span>}
              {profile?.location && <span>Location: <strong className="text-foreground/80">{profile.location}</strong></span>}
              <span>Generated: <strong className="text-foreground/80">{new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</strong></span>
            </div>
          </header>

          {/* Profile summary */}
          <section className="mb-6 avoid-break">
            <h2 className="text-lg font-bold border-b border-border pb-1 mb-3">01 · Student profile</h2>
            {profile?.long_term_goals && (
              <div className="mb-3">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Long-term goals</div>
                <p className="text-sm mt-1">{profile.long_term_goals}</p>
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <ProfileList label="Academic interests" items={profile?.academic_interests} />
              <ProfileList label="Career interests" items={profile?.career_interests} />
              <ProfileList label="Extracurriculars" items={profile?.extracurriculars} />
              <ProfileList label="Skills" items={profile?.skills} />
            </div>
          </section>

          {/* Deadline timeline */}
          {upcoming.length > 0 && (
            <section className="mb-6 avoid-break">
              <h2 className="text-lg font-bold border-b border-border pb-1 mb-3">02 · Upcoming deadlines</h2>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="py-1.5 pr-3 font-semibold">Due</th>
                    <th className="py-1.5 pr-3 font-semibold">Days</th>
                    <th className="py-1.5 pr-3 font-semibold">Opportunity</th>
                    <th className="py-1.5 font-semibold">Match</th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((r) => (
                    <tr key={r.opportunity!.id} className="border-t border-border/60">
                      <td className="py-1.5 pr-3 tabular-nums">{formatDeadline(r.opportunity!.deadline!)}</td>
                      <td className={`py-1.5 pr-3 tabular-nums font-semibold ${r.days <= 14 ? "text-primary" : "text-foreground/70"}`}>{r.days}d</td>
                      <td className="py-1.5 pr-3">{r.opportunity!.title}<span className="text-muted-foreground"> · {r.opportunity!.organization}</span></td>
                      <td className="py-1.5 tabular-nums">{r.score}/100</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* Match briefing */}
          <section>
            <h2 className="text-lg font-bold border-b border-border pb-1 mb-3">03 · Top opportunity matches</h2>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matches yet. Generate matches in the feed first.</p>
            ) : (
              <ol className="space-y-4 list-none pl-0">
                {rows.filter((r) => r.opportunity).map((r, i) => (
                  <li key={r.opportunity!.id} className="avoid-break border-l-2 border-primary/40 pl-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="font-semibold text-base">
                        <span className="text-primary mr-2 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                        {r.opportunity!.title}
                        <span className="font-normal text-muted-foreground"> · {r.opportunity!.organization}</span>
                      </div>
                      <div className="text-xs font-semibold tabular-nums shrink-0 text-primary">{r.score}/100</div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {categoryLabel(r.opportunity!.category)}
                      {r.opportunity!.deadline && <> · Due {formatDeadline(r.opportunity!.deadline)}</>}
                      {r.opportunity!.value_usd ? <> · ${r.opportunity!.value_usd.toLocaleString()}</> : null}
                      {r.opportunity!.location && <> · {r.opportunity!.location}</>}
                    </div>
                    <p className="mt-1.5 text-sm">{r.opportunity!.description}</p>
                    <p className="mt-1 text-sm"><span className="font-semibold text-primary">Why this fits: </span>{r.reasoning}</p>
                    {r.opportunity!.url && (
                      <p className="mt-1 text-xs break-all text-muted-foreground">{r.opportunity!.url}</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <footer className="mt-8 pt-4 border-t border-border text-[11px] text-muted-foreground avoid-break">
            Generated by Ascend on {new Date().toLocaleString()}. Match scores are estimates and do not guarantee acceptance.
            Share alongside a conversation with your counselor or guardian to plan next steps.
          </footer>
        </article>
      )}
    </div>
  );
}

function ProfileList({ label, items }: { label: string; items?: string[] | null }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className="mt-1">{items.join(", ")}</div>
    </div>
  );
}

function humanize(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
