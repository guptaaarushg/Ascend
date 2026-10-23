import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { generateMatches } from "@/lib/ascend.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OPPORTUNITY_CATEGORIES, categoryLabel, normalizeCategory, deadlineLabel } from "@/lib/categories";
import { normalizeOpportunityValue, formatOpportunityValue } from "@/lib/opportunity-value";
import { isZeroBarrier } from "@/lib/barriers";
import { hasPlace, isOnline, locationFit, parsePlace, type Place } from "@/lib/location";
import { BarrierRow } from "@/components/opportunity/barrier-row";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => ({ meta: [{ title: "Your opportunity feed, Ascend" }] }),
  component: Feed,
});

type MatchRow = {
  score: number;
  reasoning: string;
  is_future: boolean | null;
  future_reason: string | null;
  ready_in: string | null;
  opportunity: {
    id: string; title: string; organization: string; category: string;
    description: string; deadline: string | null; location: string | null;
    value_usd: number | null; underrepresented: boolean; competitiveness: string | null;
    application_fee: number | null; fee_waiver_available: boolean | null;
    travel_required: boolean | null; equipment_needed: string | null; format: string | null;
    remote: boolean | null;
  };
};

function Feed() {
  const runMatches = useServerFn(generateMatches);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState<string>("all");
  const [sort, setSort] = useState<"score" | "deadline">("score");
  const [query, setQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState<"all" | "remote" | "inperson">("all");
  const [awardFilter, setAwardFilter] = useState<"all" | "award">("all");
  const [compFilter, setCompFilter] = useState<string>("all");
  const [underrepOnly, setUnderrepOnly] = useState(false);
  const [nearOnly, setNearOnly] = useState(false);
  const [searchRows, setSearchRows] = useState<MatchRow["opportunity"][] | null>(null);
  const [searching, setSearching] = useState(false);
  const [userPlace, setUserPlace] = useState<Place | null>(null);
  const [firstName, setFirstName] = useState<string>("");
  // Sticky per user: a $0-barrier requirement is a real constraint, not a mood.
  const [zeroBarrier, setZeroBarrier] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);



  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const [{ data, error }, { data: prof }] = await Promise.all([
        supabase
          .from("matches")
          .select("score,reasoning,is_future,future_reason,ready_in,opportunity:opportunities(id,title,organization,category,description,deadline,location,value_usd,underrepresented,competitiveness,application_fee,fee_waiver_available,travel_required,equipment_needed,format,remote)")
          .eq("user_id", u.user.id),
        supabase.from("profiles").select("display_name,zero_barrier_filter_enabled,location,country").eq("id", u.user.id).maybeSingle(),
      ]);
      if (error) {
        setLoadError(error.message);
      } else {
        setMatches((data ?? []) as unknown as MatchRow[]);
      }
      const name = (prof?.display_name as string | undefined) ?? u.user.email?.split("@")[0] ?? "";
      setFirstName(name.split(" ")[0] ?? "");
      setZeroBarrier(!!prof?.zero_barrier_filter_enabled);
      setUserPlace(parsePlace((prof?.location as string | null | undefined) ?? null, (prof?.country as string | null | undefined) ?? null));
      setPrefsLoaded(true);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "We could not reach your feed. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => { load(); }, []);

  const searchWords = useMemo(
    () => query.toLowerCase().replace(/[%,()*"'`\\]/g, " ").split(/\s+/).filter((w) => w.length > 1).slice(0, 5),
    [query],
  );
  const searchActive = searchWords.length > 0;

  useEffect(() => {
    if (searchWords.length === 0) {
      setSearchRows(null);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      let req: any = supabase
        .from("opportunities")
        .select("id,title,organization,category,description,deadline,location,value_usd,underrepresented,competitiveness,application_fee,fee_waiver_available,travel_required,equipment_needed,format,remote")
        .eq("status", "approved");
      for (const w of searchWords) {
        req = req.or(`title.ilike.%${w}%,organization.ilike.%${w}%,description.ilike.%${w}%`);
      }
      const { data, error } = await req.limit(80);
      if (cancelled) return;
      if (error) {
        toast.error("Search failed. Try again in a moment.");
        setSearchRows([]);
      } else {
        const rank = (o: MatchRow["opportunity"]) =>
          searchWords.reduce((n, w) => n + (o.title.toLowerCase().includes(w) ? 2 : 0) + (o.organization.toLowerCase().includes(w) ? 1 : 0), 0);
        const rows = ((data ?? []) as MatchRow["opportunity"][]).slice().sort((a, b) => rank(b) - rank(a) || a.title.localeCompare(b.title));
        setSearchRows(rows);
      }
      setSearching(false);
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchWords]);

  // Persist the $0-barrier preference so it survives sessions and devices.
  const toggleZeroBarrier = async (next: boolean) => {
    setZeroBarrier(next);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const patch = next
      ? { zero_barrier_filter_enabled: true, zero_barrier_filter_used: true }
      : { zero_barrier_filter_enabled: false };
    const { error } = await supabase.from("profiles").update(patch).eq("id", u.user.id);
    if (error) toast.error(error.message);
  };


  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await runMatches();
      const futureNote = res.future ? ` Plus ${res.future} to aim for down the road.` : "";
      toast.success(`Refreshed, ${res.matched} matches updated.${futureNote}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  const currentMatches = matches.filter((m) => !m.is_future && m.score >= 80);
  const futureMatches = matches.filter((m) => !!m.is_future && m.score >= 80);
  // Fallback lane: 70 to 84. Never shown alongside strong matches, only when
  // the strong lane is empty, so the feed is never a dead end on first run.
  const closeMatches = matches.filter((m) => !m.is_future && m.score >= 70 && m.score < 80);
  const sortFn = (a: MatchRow, b: MatchRow) => {
    if (sort === "score") return (b.score + locationFit(userPlace, b.opportunity).score * 0.4) - (a.score + locationFit(userPlace, a.opportunity).score * 0.4);
    const ad = a.opportunity?.deadline ?? "9999-12-31";
    const bd = b.opportunity?.deadline ?? "9999-12-31";
    return ad.localeCompare(bd);
  };
  const q = query.trim().toLowerCase();
  const passesFilters = (o: MatchRow["opportunity"]) => {
    if (category !== "all" && normalizeCategory(o.category) !== category) return false;
    if (zeroBarrier && !isZeroBarrier(o)) return false;
    if (locationFilter === "remote" && !isOnline(o)) return false;
    if (locationFilter === "inperson" && isOnline(o)) return false;
    if (nearOnly && locationFit(userPlace, o).kind === "elsewhere") return false;
    if (awardFilter === "award" && !normalizeOpportunityValue(o.value_usd, o.description)) return false;
    if (compFilter !== "all" && (o.competitiveness ?? "").toLowerCase() !== compFilter) return false;
    if (underrepOnly && !o.underrepresented) return false;
    return true;
  };
  const filterFn = (m: MatchRow) => !!m.opportunity && passesFilters(m.opportunity);
  const visibleSearch = (searchRows ?? []).filter((o) => passesFilters(o));
  const matchById = new Map(matches.filter((m) => m.opportunity).map((m) => [m.opportunity.id, m]));
  const filtered = currentMatches.filter(filterFn).sort(sortFn);
  const filteredFuture = futureMatches.filter(filterFn).sort((a, b) => b.score - a.score);
  const filteredClose = closeMatches.filter(filterFn).sort(sortFn);
  const showClose = filtered.length === 0 && filteredClose.length > 0;
  // Feed bar: only 85+ matches are ever displayed in the main lane.




  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const totalMatches = currentMatches.length;
  const topScore = currentMatches.reduce((m, r) => Math.max(m, r.score ?? 0), 0);
  const urgentCount = currentMatches.filter((m) => {
    if (!m.opportunity?.deadline) return false;
    const d = Math.ceil((new Date(m.opportunity.deadline).getTime() - Date.now()) / 86400000);
    return d >= 0 && d <= 14;
  }).length;
  const weekday = new Date().toLocaleDateString(undefined, { weekday: "long" });

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      {/* Personal Student Dashboard widget */}
      <div className="mb-6 rounded-2xl border border-primary/15 bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.14em] text-primary/70 font-semibold">Student dashboard</div>
            <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight">
              {timeGreeting}{firstName ? `, ${firstName}` : ""}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Happy {weekday}. Here's your focus this week.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <StatTile label="Matches" value={totalMatches} />
            <StatTile label="Top score" value={topScore || "--"} accent />
            <StatTile label="Due ≤14d" value={urgentCount} warn={urgentCount > 0} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your opportunity feed</h1>
          <p className="text-muted-foreground mt-1 text-sm">Matched to your Life Profile. Higher score = stronger fit.</p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-44" aria-label="Filter by category"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {OPPORTUNITY_CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as any)}>
            <SelectTrigger className="w-40" aria-label="Sort opportunities"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="score">Sort: Match score</SelectItem>
              <SelectItem value="deadline">Sort: Deadline</SelectItem>
            </SelectContent>
          </Select>

          <Button asChild variant="outline">
            <Link to="/tracker">Tracker</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/export">Share with counselor</Link>
          </Button>
          <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
            {refreshing ? "Matching…" : "Refresh"}
          </Button>

        </div>
      </div>

      <div className="mb-4">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search opportunities by name, organization, or keyword…"
          aria-label="Search opportunities"
          className="h-11 rounded-xl"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <FilterChip active={locationFilter === "remote"} onClick={() => setLocationFilter(locationFilter === "remote" ? "all" : "remote")}>Remote</FilterChip>
          <FilterChip active={locationFilter === "inperson"} onClick={() => setLocationFilter(locationFilter === "inperson" ? "all" : "inperson")}>In-person</FilterChip>
          {hasPlace(userPlace) && (
            <FilterChip active={nearOnly} onClick={() => setNearOnly(!nearOnly)}>Near me or online</FilterChip>
          )}
          {prefsLoaded && !hasPlace(userPlace) && (
            <span className="text-xs text-muted-foreground">Add your city and state in your profile to see programs near you.</span>
          )}
          <FilterChip active={awardFilter === "award"} onClick={() => setAwardFilter(awardFilter === "award" ? "all" : "award")}>Has award money</FilterChip>
          <FilterChip active={underrepOnly} onClick={() => setUnderrepOnly(!underrepOnly)}>Underrepresented-friendly</FilterChip>
          <Select value={compFilter} onValueChange={setCompFilter}>
            <SelectTrigger className="w-40 h-8 rounded-full text-xs" aria-label="Filter by competitiveness"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any competitiveness</SelectItem>
              <SelectItem value="low">Low competition</SelectItem>
              <SelectItem value="medium">Medium competition</SelectItem>
              <SelectItem value="high">High competition</SelectItem>
            </SelectContent>
          </Select>
          {(q || locationFilter !== "all" || awardFilter !== "all" || compFilter !== "all" || underrepOnly || nearOnly) && (
            <button
              type="button"
              onClick={() => { setQuery(""); setLocationFilter("all"); setAwardFilter("all"); setCompFilter("all"); setUnderrepOnly(false); setNearOnly(false); }}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/15 bg-primary/[0.03] px-4 py-3">
        <div className="min-w-0">
          <label htmlFor="zero-barrier" className="text-sm font-semibold cursor-pointer">
            Show only $0-barrier opportunities
          </label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Free to apply or fee waiver available, and no travel required. We remember this for you.
          </p>
        </div>
        <Switch
          id="zero-barrier"
          checked={zeroBarrier}
          onCheckedChange={toggleZeroBarrier}
          disabled={!prefsLoaded}
        />
      </div>

      <p className="sr-only" role="status" aria-live="polite">

        {loading
          ? "Loading your matches"
          : loadError
            ? `Could not load matches. ${loadError}`
            : `${filtered.length} matches ready${filteredFuture.length ? `, plus ${filteredFuture.length} future goals` : ""}`}
      </p>

      {searchActive ? (
        <div className="grid gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Search results</h2>
            <span className="text-xs text-muted-foreground">
              {searching ? "Searching…" : `${visibleSearch.length}${(searchRows?.length ?? 0) >= 80 ? "+" : ""} found`}
            </span>
          </div>
          {!searching && visibleSearch.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No programs found for "{query.trim()}". Try fewer words, or the program's short name, like "USACO" or "QuestBridge".
            </p>
          )}
          {visibleSearch.map((o) => (
            <SearchResultCard key={o.id} opp={o} score={matchById.get(o.id)?.score ?? null} place={userPlace} />
          ))}
        </div>
      ) : loading ? (
        <div className="grid gap-4">
          {[1,2,3].map(i => <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
          <h2 className="font-semibold">We could not load your matches</h2>
          <p className="text-sm text-muted-foreground mt-1">{loadError}</p>
          <Button className="mt-4" onClick={() => load()}>Try again</Button>
        </div>
      ) : filtered.length === 0 && filteredFuture.length === 0 && !showClose ? (
        <EmptyState onRefresh={handleRefresh} refreshing={refreshing} hasAny={matches.length > 0} />
      ) : (

        <div className="grid gap-4">
          {filtered.map((m) => <OpportunityCard key={m.opportunity.id} match={m} place={userPlace} />)}
          {showClose && (
            <div>
              <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4 text-sm mb-4">
                <p className="font-medium">No 80+ matches here yet, so here are your closest fits</p>
                <p className="text-muted-foreground mt-1">
                  These scored between 70 and 79. They are worth a look while you strengthen your Life Profile, which is what pushes scores into the 80+ lane.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild size="sm"><Link to="/profile">Strengthen my profile</Link></Button>
                  <Button onClick={handleRefresh} disabled={refreshing} size="sm" variant="outline">
                    {refreshing ? "Matching…" : "Refresh matches"}
                  </Button>
                </div>
              </div>
              <div className="grid gap-4">
                {filteredClose.map((m) => <OpportunityCard key={m.opportunity.id} match={m} place={userPlace} />)}
              </div>
            </div>
          )}

          {filtered.length > 0 && filtered.length < 15 && (
            <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4 text-sm">
              <p className="font-medium">Want more than {filtered.length} strong matches?</p>
              <p className="text-muted-foreground mt-1">
                Hit Refresh to bring in new programs from the full catalog, or add more to your Life Profile. Only opportunities scoring 80 or above show up here.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={handleRefresh} disabled={refreshing} size="sm">
                  {refreshing ? "Matching…" : "Refresh matches"}
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/profile">Strengthen my profile</Link>
                </Button>
              </div>
            </div>
          )}
          {filteredFuture.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-semibold tracking-tight">For your future</h2>
                <span className="text-xs text-muted-foreground">({filteredFuture.length})</span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                You aren't eligible for these yet, but they fit your goals. Save them so you're ready when the window opens.
              </p>
              <div className="grid gap-4">
                {filteredFuture.map((m) => <OpportunityCard key={m.opportunity.id} match={m} place={userPlace} />)}
              </div>
            </div>
          )}
        </div>
      )}


    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({ onRefresh, refreshing, hasAny }: { onRefresh: () => void; refreshing: boolean; hasAny: boolean }) {
  return (
    <Card className="text-center py-16">
      <CardContent>
        <h3 className="text-lg font-semibold">{hasAny ? "Nothing in this category yet" : "No matches yet"}</h3>
        <p className="text-muted-foreground mt-1 max-w-sm mx-auto">
          {hasAny ? "Try a different category, turn off the $0-barrier filter, or refresh." : "Generate your first set of personalized matches to get started."}
        </p>
        <Button onClick={onRefresh} disabled={refreshing} className="mt-4">
          {refreshing ? "Matching…" : "Generate matches"}
        </Button>
      </CardContent>
    </Card>

  );
}

function OpportunityCard({ match, place }: { match: MatchRow; place: Place | null }) {
  const o = match.opportunity;
  if (!o) return null;
  const fit = locationFit(place, o);
  const isFuture = !!match.is_future;
  const daysToDeadline = o.deadline ? Math.ceil((new Date(o.deadline).getTime() - Date.now()) / 86400000) : null;
  const urgent = !isFuture && daysToDeadline !== null && daysToDeadline >= 0 && daysToDeadline <= 30;
  return (
    <Card className={`overflow-hidden transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_12px_40px_rgba(224,90,71,0.10)] ${isFuture ? "border-dashed border-primary/30 bg-primary/[0.02]" : ""}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5 flex-wrap">
              <span className="uppercase tracking-wider text-[10px] font-semibold text-primary/80 px-2 py-0.5 rounded-full bg-primary/10 ring-1 ring-primary/20">{categoryLabel(o.category)}</span>
              <span>·</span>
              <span>{o.organization}</span>
              {isFuture && (
                <Badge variant="outline" className="ml-1 text-[10px] border-primary/40 text-primary">
                  Future goal{match.ready_in ? ` · ${match.ready_in}` : ""}
                </Badge>
              )}
              {o.underrepresented && <Badge variant="secondary" className="ml-1 text-[10px]">Underrepresented-friendly</Badge>}
            </div>
            <h3 className="text-lg font-semibold leading-tight">{o.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{o.description}</p>
            <div className="mt-3 p-3 rounded-md bg-primary/5 border border-primary/10 text-sm">
              <span className="font-medium text-primary">{isFuture ? "Why aim for this: " : "Why you: "}</span>
              <span className="text-foreground/90">{match.reasoning}</span>
            </div>
            {isFuture && match.future_reason && (
              <div className="mt-2 p-3 rounded-md bg-muted/50 border border-border/60 text-sm">
                <span className="font-medium">To unlock: </span>
                <span className="text-foreground/90">{match.future_reason}</span>
              </div>
            )}
            <BarrierRow opportunity={o} />
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span className={urgent ? "text-warning-foreground font-medium" : ""}>
                {o.deadline
                  ? `${urgent ? "Due " : ""}${deadlineLabel(o.deadline)}${!isFuture && daysToDeadline !== null && daysToDeadline >= 0 ? ` (${daysToDeadline}d)` : ""}`
                  : deadlineLabel(null)}
              </span>

              {o.location && <span>{o.location}</span>}
              {fit.label && (
                <Badge variant={fit.kind === "elsewhere" ? "outline" : "secondary"} className="text-[10px]">{fit.label}</Badge>
              )}
              {(() => {
                const v = normalizeOpportunityValue(o.value_usd, o.description);
                return v ? (
                  <span title={v.label}>{formatOpportunityValue(v)}</span>
                ) : null;
              })()}
            </div>
          </div>
          <div className="flex flex-col items-center gap-3 shrink-0">
            <MatchScore score={match.score} future={isFuture} />
            <Button asChild size="default" variant={isFuture ? "outline" : "default"} className="font-medium">
              <Link to="/opportunity/$id" params={{ id: o.id }}>{isFuture ? "Preview" : "Open"}</Link>
            </Button>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}

function SearchResultCard({ opp: o, score, place }: { opp: MatchRow["opportunity"]; score: number | null; place: Place | null }) {
  const fit = locationFit(place, o);
  const daysToDeadline = o.deadline ? Math.ceil((new Date(o.deadline).getTime() - Date.now()) / 86400000) : null;
  return (
    <Card className="overflow-hidden transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/30">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5 flex-wrap">
              <span className="uppercase tracking-wider text-[10px] font-semibold text-primary/80 px-2 py-0.5 rounded-full bg-primary/10 ring-1 ring-primary/20">{categoryLabel(o.category)}</span>
              <span>·</span>
              <span>{o.organization}</span>
              {o.underrepresented && <Badge variant="secondary" className="ml-1 text-[10px]">Underrepresented-friendly</Badge>}
            </div>
            <h3 className="text-lg font-semibold leading-tight">{o.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{o.description}</p>
            <BarrierRow opportunity={o} />
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span>{o.deadline ? `${deadlineLabel(o.deadline)}${daysToDeadline !== null && daysToDeadline >= 0 ? ` (${daysToDeadline}d)` : ""}` : deadlineLabel(null)}</span>
              {o.location && <span>{o.location}</span>}
              {fit.label && <Badge variant={fit.kind === "elsewhere" ? "outline" : "secondary"} className="text-[10px]">{fit.label}</Badge>}
              {(() => {
                const v = normalizeOpportunityValue(o.value_usd, o.description);
                return v ? <span title={v.label}>{formatOpportunityValue(v)}</span> : null;
              })()}
            </div>
          </div>
          <div className="flex flex-col items-center gap-3 shrink-0">
            {score !== null && <MatchScore score={score} />}
            <Button asChild size="default" className="font-medium">
              <Link to="/opportunity/$id" params={{ id: o.id }}>Open</Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatTile({ label, value, accent, warn }: { label: string; value: number | string; accent?: boolean; warn?: boolean }) {
  const tone = warn
    ? "text-primary border-primary/30 bg-primary/8"
    : accent
      ? "text-primary border-primary/20 bg-primary/5"
      : "text-foreground border-border bg-card";
  return (
    <div className={`min-w-[84px] rounded-xl border px-3 py-2 text-center transition-transform duration-150 hover:-translate-y-0.5 ${tone}`}>
      <div className="text-xl font-bold tabular-nums leading-tight">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}


function MatchScore({ score, future }: { score: number; future?: boolean }) {
  const color = future ? "text-primary/70" : score >= 80 ? "text-success" : score >= 60 ? "text-primary" : "text-muted-foreground";
  return (
    <div className="flex flex-col items-center">
      <div className={`text-2xl font-bold ${color}`}>{score}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{future ? "future fit" : "match"}</div>
    </div>
  );
}
