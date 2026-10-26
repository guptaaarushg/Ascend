   
                                                                         
                                                                                
   

export type DigestPayload = {
  userId: string;
  displayName: string;
  subject: string;
  text: string;
  html: string;
  matchCount: number;
  deadlineCount: number;
};

const STYLE_NOTE =
  "Warm, direct, second person. No em dashes.";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function daysUntil(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

   
                                                                            
                                         
   
export async function buildDigestForUser(userId: string): Promise<DigestPayload | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [{ data: profile }, { data: matches }, { data: tracked }] = await Promise.all([
    supabaseAdmin.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    supabaseAdmin
      .from("matches")
      .select(
        "score,reasoning,opportunity:opportunities(id,title,organization,deadline,application_fee,fee_waiver_available,travel_required)",
      )
      .eq("user_id", userId)
      .eq("is_future", false)
      .gte("score", 85)
      .order("score", { ascending: false })
      .limit(25),
    supabaseAdmin.from("user_opportunities").select("opportunity_id").eq("user_id", userId),
  ]);

  const seen = new Set((tracked ?? []).map((t: any) => t.opportunity_id));
  const rows = (matches ?? []).filter((m: any) => m.opportunity && !seen.has(m.opportunity.id));

  const top = rows.slice(0, 3);
  const deadlines = (matches ?? [])
    .map((m: any) => m.opportunity)
    .filter((o: any) => o?.deadline && daysUntil(o.deadline) >= 0 && daysUntil(o.deadline) <= 14)
    .sort((a: any, b: any) => a.deadline.localeCompare(b.deadline))
    .slice(0, 8);

  if (!top.length && !deadlines.length) return null;

  const firstName = (profile?.display_name ?? "").split(" ")[0] || "there";

  const lines: string[] = [];
  lines.push(`Hi ${firstName}, here is your Ascend digest.`);
  lines.push("");
  if (top.length) {
    lines.push("New matches worth your time:");
    for (const m of top) {
      const o: any = m.opportunity;
      const free = o.application_fee === 0 || o.fee_waiver_available === true;
      lines.push(
        `- ${o.title} (${o.organization}), match ${m.score}${free ? ", free to apply" : ""}. ${m.reasoning}`,
      );
    }
    lines.push("");
  }
  if (deadlines.length) {
    lines.push("Due in the next 14 days:");
    for (const o of deadlines) {
      lines.push(`- ${o.title}, ${new Date(o.deadline).toLocaleDateString()} (${daysUntil(o.deadline)} days left)`);
    }
    lines.push("");
  }
  lines.push("Open your feed to act on these while the windows are still open.");

  const text = lines.join("\n");

  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#FDFBF7;padding:24px;color:#1A1A1A">
  <h1 style="font-size:20px;margin:0 0 12px">Hi ${esc(firstName)}, here is your Ascend digest.</h1>
  ${
    top.length
      ? `<h2 style="font-size:15px;color:#E05A47;margin:20px 0 8px">New matches worth your time</h2>
  <ul style="padding-left:18px;margin:0">${top
    .map((m: any) => {
      const o = m.opportunity;
      const free = o.application_fee === 0 || o.fee_waiver_available === true;
      return `<li style="margin-bottom:10px"><strong>${esc(o.title)}</strong> (${esc(o.organization)}), match ${m.score}${
        free ? ", free to apply" : ""
      }<br/><span style="color:#4A4A4A">${esc(String(m.reasoning ?? ""))}</span></li>`;
    })
    .join("")}</ul>`
      : ""
  }
  ${
    deadlines.length
      ? `<h2 style="font-size:15px;color:#E05A47;margin:20px 0 8px">Due in the next 14 days</h2>
  <ul style="padding-left:18px;margin:0">${deadlines
    .map(
      (o: any) =>
        `<li style="margin-bottom:6px">${esc(o.title)}, ${new Date(o.deadline).toLocaleDateString()} (${daysUntil(
          o.deadline,
        )} days left)</li>`,
    )
    .join("")}</ul>`
      : ""
  }
  <p style="margin-top:24px;color:#4A4A4A">Open your feed to act on these while the windows are still open.</p>
</div>`;

  return {
    userId,
    displayName: firstName,
    subject:
      deadlines.length > 0
        ? `${deadlines.length} deadline${deadlines.length === 1 ? "" : "s"} coming up on Ascend`
        : "Your new Ascend matches",
    text,
    html,
    matchCount: top.length,
    deadlineCount: deadlines.length,
  };
}

                                                                             
export async function usersDueForDigest(frequency: "daily" | "weekly") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const cutoffHours = frequency === "daily" ? 20 : 24 * 6.5;
  const cutoff = new Date(Date.now() - cutoffHours * 3600_000).toISOString();

  const { data } = await supabaseAdmin
    .from("notification_preferences")
    .select("user_id,last_sent_at")
    .eq("email_digest_enabled", true)
    .eq("frequency", frequency);

  return (data ?? []).filter((r: any) => !r.last_sent_at || r.last_sent_at < cutoff).map((r: any) => r.user_id as string);
}

export async function markDigestSent(userIds: string[]) {
  if (!userIds.length) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("notification_preferences")
    .update({ last_sent_at: new Date().toISOString() })
    .in("user_id", userIds);
}

export const DIGEST_STYLE_NOTE = STYLE_NOTE;
