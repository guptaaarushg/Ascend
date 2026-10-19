import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { categoryLabel } from "@/lib/categories";

import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tracker")({
  head: () => ({ meta: [{ title: "Application Tracker, Ascend" }] }),
  component: Tracker,
});

type Status = "saved" | "applied" | "accepted" | "declined";
type Row = {
  id: string;
  status: Status;
  notes: string | null;
  updated_at: string;
  opportunity: {
    id: string; title: string; organization: string; category: string;
    deadline: string | null; value_usd: number | null;
  } | null;
};

const STATUS_META: Record<Status, { label: string; blurb: string; tint: string }> = {
  saved: { label: "Interested", blurb: "Opportunities you've bookmarked to consider.", tint: "text-primary" },
  applied: { label: "Applied", blurb: "Applications you've sent in.", tint: "text-primary" },
  accepted: { label: "Accepted", blurb: "You got in. Celebrate the wins.", tint: "text-success" },
  declined: { label: "Not accepted", blurb: "Doors that didn't open this time. On to the next.", tint: "text-muted-foreground" },
};


function Tracker() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
    const { data: s } = await supabase.auth.getSession();
    const u = { user: s.session?.user };
    if (!u.user) return;
    const { data, error } = await supabase
      .from("user_opportunities")
      .select("id,status,notes,updated_at,opportunity:opportunities(id,title,organization,category,deadline,value_usd)")
      .eq("user_id", u.user.id)
      .order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    else setRows((data ?? []) as unknown as Row[]);
    } catch {
      toast.error("Couldn't load your tracker. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const counts: Record<Status, number> = {
    saved: rows.filter((r) => r.status === "saved").length,
    applied: rows.filter((r) => r.status === "applied").length,
    accepted: rows.filter((r) => r.status === "accepted").length,
    declined: rows.filter((r) => r.status === "declined").length,
  };
  const total = rows.length;

  const setStatus = async (id: string, next: Status) => {
    const prev = rows;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: next } : r)));
    const { error } = await supabase.from("user_opportunities").update({ status: next }).eq("id", id);
    if (error) { setRows(prev); toast.error(error.message); }
    else toast.success(`Moved to ${STATUS_META[next].label}.`);
  };

  const remove = async (id: string) => {
    const prev = rows;
    setRows((rs) => rs.filter((r) => r.id !== id));
    const { error } = await supabase.from("user_opportunities").delete().eq("id", id);
    if (error) { setRows(prev); toast.error(error.message); }
  };

  const listFor = (status: Status | "all") => {
    const list = status === "all" ? rows : rows.filter((r) => r.status === status);
    if (loading) return <div className="grid gap-3">{[1,2,3].map(i => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>;
    if (!list.length) return <EmptyPanel status={status} />;
    return (
      <div className="grid gap-3">
        {list.map((r) => <TrackerRow key={r.id} row={r} onStatus={setStatus} onRemove={remove} />)}
      </div>
    );
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/5 via-background to-background p-5 sm:p-6 shadow-[0_4px_20px_rgba(224,90,71,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.14em] text-primary/70 font-semibold">Application tracker</div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight">Your opportunity pipeline</h1>
            <p className="text-sm text-muted-foreground mt-1">Everything you've saved, sent in, or heard back on. Move cards through the stages as your search progresses.</p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {(Object.keys(STATUS_META) as Status[]).map((s) => (
              <div key={s} className="min-w-[76px] rounded-xl border px-3 py-2 text-center bg-card">
                <div className="text-xl font-bold tabular-nums leading-tight">{counts[s]}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{STATUS_META[s].label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Tabs defaultValue="all">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">All ({total})</TabsTrigger>
          {(Object.keys(STATUS_META) as Status[]).map((s) => (
            <TabsTrigger key={s} value={s}>{STATUS_META[s].label} ({counts[s]})</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="all" className="mt-4">{listFor("all")}</TabsContent>
        {(Object.keys(STATUS_META) as Status[]).map((s) => (
          <TabsContent key={s} value={s} className="mt-4">
            <p className="text-sm text-muted-foreground mb-3">{STATUS_META[s].blurb}</p>
            {listFor(s)}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function TrackerRow({ row, onStatus, onRemove }: { row: Row; onStatus: (id: string, s: Status) => void; onRemove: (id: string) => void }) {
  const o = row.opportunity;
  if (!o) return null;
  const meta = STATUS_META[row.status];
  const days = o.deadline ? Math.ceil((new Date(o.deadline).getTime() - Date.now()) / 86400000) : null;
  return (
    <Card className="overflow-hidden hover:-translate-y-0.5 transition-transform hover:shadow-[0_12px_40px_rgba(224,90,71,0.08)]">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs mb-1.5">
              <Badge variant="outline" className={`${meta.tint} border-current/30`}>
                {meta.label}
              </Badge>

              <span className="uppercase tracking-wider text-[10px] font-semibold text-primary/80 px-2 py-0.5 rounded-full bg-primary/10 ring-1 ring-primary/20">{categoryLabel(o.category)}</span>
              <span className="text-muted-foreground truncate">{o.organization}</span>
            </div>
            <h3 className="font-semibold leading-tight">{o.title}</h3>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                {o.deadline
                  ? `${new Date(o.deadline).toLocaleDateString()}${days !== null && days >= 0 ? ` (${days}d)` : ""}`
                  : "Deadline not listed, check the program site"}
              </span>

              {o.value_usd ? <span>${o.value_usd.toLocaleString()}</span> : null}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <Button asChild size="sm" variant="outline">
              <Link to="/opportunity/$id" params={{ id: o.id }}>Open </Link>
            </Button>
            <div className="flex flex-wrap gap-1 justify-end">
              {(Object.keys(STATUS_META) as Status[])
                .filter((s) => s !== row.status)
                .map((s) => (
                  <Button key={s} size="sm" variant="ghost" className="h-7 text-[11px] px-2" onClick={() => onStatus(row.id, s)}>
                    → {STATUS_META[s].label}
                  </Button>
                ))}
              <Button size="sm" variant="ghost" className="h-7 text-[11px] px-2 text-muted-foreground" onClick={() => onRemove(row.id)}>
                Remove
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyPanel({ status }: { status: Status | "all" }) {
  const label = status === "all" ? "your tracker" : STATUS_META[status as Status].label.toLowerCase();
  return (
    <Card className="text-center py-14">
      <CardContent>
        
        <h3 className="text-base font-semibold">Nothing in {label} yet</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
          Save an opportunity from your feed to start tracking it here. You can move it through Interested, Applied, Accepted, and Not accepted as things progress.
        </p>
        <Button asChild className="mt-4">
          <Link to="/feed">Browse your feed</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
