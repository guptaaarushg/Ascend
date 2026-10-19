import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OPPORTUNITY_CATEGORIES } from "@/lib/categories";
import { toast } from "sonner";
import { sanitizeText } from "@/lib/validation";

import { Plus, Pencil, Trash2, Check, X, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin, Ascend" }] }),
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
    if (!roles?.some((r) => r.role === "admin")) throw redirect({ to: "/feed" });
  },
  component: AdminPage,
});

const empty = {
  id: "", title: "", organization: "", category: "scholarship", description: "",
  eligibility: "", location: "", remote: false, deadline: "", value_usd: "",
  url: "", tags: "", related_skills: "", pathway_unlocks: "", competitiveness: "medium", underrepresented: false,
  // Real cost of applying. Blank means unknown, never assume free.
  application_fee: "", fee_waiver_available: "unknown", travel_required: "unknown",
  equipment_needed: "", format: "unknown",
};

const TRISTATE = [
  { v: "unknown", label: "Not listed" },
  { v: "yes", label: "Yes" },
  { v: "no", label: "No" },
];
const triToBool = (v: string) => (v === "yes" ? true : v === "no" ? false : null);
const boolToTri = (v: boolean | null | undefined) => (v === true ? "yes" : v === false ? "no" : "unknown");

function AdminPage() {
  const [items, setItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<typeof empty | null>(null);

  const load = async () => {
    const { data } = await supabase.from("opportunities").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const startEdit = (o?: any) => {
    if (o) setEditing({
      ...empty, ...o,
      deadline: o.deadline ?? "",
      value_usd: o.value_usd?.toString() ?? "",
      tags: (o.tags ?? []).join(", "),
      related_skills: (o.related_skills ?? []).join(", "),
      pathway_unlocks: (o.pathway_unlocks ?? []).join(", "),
      application_fee: o.application_fee?.toString() ?? "",
      fee_waiver_available: boolToTri(o.fee_waiver_available),
      travel_required: boolToTri(o.travel_required),
      equipment_needed: o.equipment_needed ?? "",
      format: o.format ?? "unknown",
    });
    else setEditing({ ...empty });
  };

  const csv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

  const save = async () => {
    if (!editing) return;
    const title = sanitizeText(editing.title);
    const organization = sanitizeText(editing.organization);
    const url = sanitizeText(editing.url);
    if (title.length < 3 || organization.length < 2) {
      toast.error("Title and organization are required");
      return;
    }
    if (url && !/^https?:\/\/[^\s]+$/i.test(url)) {
      toast.error("Link must be a full http(s) URL");
      return;
    }
    const payload: any = {
      title, organization, category: editing.category,
      description: sanitizeText(editing.description), eligibility: sanitizeText(editing.eligibility),
      location: sanitizeText(editing.location) || null, remote: editing.remote,
      deadline: editing.deadline || null, value_usd: editing.value_usd ? Number(editing.value_usd) : null,
      url: url || null, tags: csv(editing.tags), related_skills: csv(editing.related_skills),
      pathway_unlocks: csv(editing.pathway_unlocks), competitiveness: editing.competitiveness,
      underrepresented: editing.underrepresented,
      application_fee: editing.application_fee === "" ? null : Number(editing.application_fee),
      fee_waiver_available: triToBool(editing.fee_waiver_available),
      travel_required: triToBool(editing.travel_required),
      equipment_needed: sanitizeText(editing.equipment_needed) || null,
      format: editing.format === "unknown" ? null : editing.format,
      status: "approved",
    };

    const { error } = editing.id
      ? await supabase.from("opportunities").update(payload).eq("id", editing.id)
      : await supabase.from("opportunities").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success("Saved"); setEditing(null); load(); }
  };

  const setStatus = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("opportunities").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(status === "approved" ? "Approved, now visible to students" : "Rejected"); load(); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this opportunity?")) return;
    const { error } = await supabase.from("opportunities").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); load(); }
  };

  const pending = items.filter((o) => o.status === "pending");
  const reviewed = items.filter((o) => o.status !== "pending");

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Admin, Opportunities</h1>
          <p className="text-muted-foreground">{items.length} total · {pending.length} awaiting review</p>
        </div>
        <Button onClick={() => startEdit()}><Plus className="size-4 mr-1" /> New opportunity</Button>
      </div>

      {pending.length > 0 && (
        <Card className="mb-6 border-warning/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Badge variant="secondary">Pending Review</Badge>
              {pending.length} AI-discovered opportunities need approval before students see them
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {pending.map((o) => (
              <div key={o.id} className="rounded-md border p-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-muted-foreground">{o.category} · {o.organization}</div>
                  <div className="font-medium">{o.title}</div>
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{o.description}</div>
                  {o.url && (
                    <a href={o.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary inline-flex items-center gap-1 mt-1">
                      Source <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button size="sm" onClick={() => setStatus(o.id, "approved")}><Check className="size-4 mr-1" /> Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => setStatus(o.id, "rejected")}><X className="size-4 mr-1" /> Reject</Button>
                  <Button size="sm" variant="ghost" onClick={() => startEdit(o)}><Pencil className="size-4" /></Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}


      {editing && (
        <Card className="mb-6">
          <CardHeader><CardTitle>{editing.id ? "Edit" : "New"} opportunity</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Title"><Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>
              <Field label="Organization"><Input value={editing.organization} onChange={(e) => setEditing({ ...editing, organization: e.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Category">
                <Select value={editing.category} onValueChange={(v) => setEditing({ ...editing, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{OPPORTUNITY_CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Competitiveness">
                <Select value={editing.competitiveness} onValueChange={(v) => setEditing({ ...editing, competitiveness: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["low","medium","high"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Description"><Textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={3} /></Field>
            <Field label="Eligibility"><Textarea value={editing.eligibility} onChange={(e) => setEditing({ ...editing, eligibility: e.target.value })} rows={2} /></Field>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Location"><Input value={editing.location} onChange={(e) => setEditing({ ...editing, location: e.target.value })} /></Field>
              <Field label="Deadline (YYYY-MM-DD)"><Input value={editing.deadline} onChange={(e) => setEditing({ ...editing, deadline: e.target.value })} /></Field>
              <Field label="Value USD"><Input type="number" value={editing.value_usd} onChange={(e) => setEditing({ ...editing, value_usd: e.target.value })} /></Field>
            </div>
            <Field label="URL"><Input value={editing.url} onChange={(e) => setEditing({ ...editing, url: e.target.value })} /></Field>
            <Field label="Tags (comma-separated)"><Input value={editing.tags} onChange={(e) => setEditing({ ...editing, tags: e.target.value })} /></Field>
            <Field label="Related skills"><Input value={editing.related_skills} onChange={(e) => setEditing({ ...editing, related_skills: e.target.value })} /></Field>
            <Field label="Pathway unlocks"><Input value={editing.pathway_unlocks} onChange={(e) => setEditing({ ...editing, pathway_unlocks: e.target.value })} /></Field>
            <div className="rounded-xl border border-primary/15 bg-primary/[0.03] p-4 space-y-3">
              <p className="text-sm font-semibold">What it actually takes</p>
              <p className="text-xs text-muted-foreground">Leave anything blank or "Not listed" when the source page does not say. Unknown is better than a guess.</p>
              <div className="grid sm:grid-cols-3 gap-3">
                <Field label="Application fee (USD, 0 = free)">
                  <Input type="number" min="0" value={editing.application_fee} onChange={(e) => setEditing({ ...editing, application_fee: e.target.value })} placeholder="blank = not listed" />
                </Field>
                <Field label="Fee waiver available">
                  <Select value={editing.fee_waiver_available} onValueChange={(v) => setEditing({ ...editing, fee_waiver_available: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TRISTATE.map((t) => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Travel required">
                  <Select value={editing.travel_required} onValueChange={(v) => setEditing({ ...editing, travel_required: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TRISTATE.map((t) => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Format">
                  <Select value={editing.format} onValueChange={(v) => setEditing({ ...editing, format: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unknown">Not listed</SelectItem>
                      <SelectItem value="virtual">Virtual</SelectItem>
                      <SelectItem value="in_person">In person</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Equipment needed">
                  <Input value={editing.equipment_needed} onChange={(e) => setEditing({ ...editing, equipment_needed: e.target.value })} placeholder="e.g. laptop and reliable internet" />
                </Field>
              </div>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.remote} onChange={(e) => setEditing({ ...editing, remote: e.target.checked })} /> Remote</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.underrepresented} onChange={(e) => setEditing({ ...editing, underrepresented: e.target.checked })} /> Underrepresented-friendly</label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save}>Save</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-2">
        {reviewed.map((o) => (
          <Card key={o.id}>
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  {o.status === "rejected" && <Badge variant="outline" className="text-[10px]">Rejected</Badge>}
                  {o.category} · {o.organization}
                </div>
                <div className="font-medium truncate">{o.title}</div>
              </div>
              <div className="flex gap-1">
                {o.status === "rejected" && (
                  <Button size="sm" variant="ghost" onClick={() => setStatus(o.id, "approved")}><Check className="size-4" /></Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => startEdit(o)}><Pencil className="size-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => remove(o.id)}><Trash2 className="size-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
