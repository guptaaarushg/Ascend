import { createFileRoute } from "@tanstack/react-router";
import {
  isPublicHttpUrl,
  nextLinkState,
  verdictForError,
  verdictForStatus,
  type LinkVerdict,
} from "@/lib/link-health";

const BATCH_SIZE = 30;
const CONCURRENCY = 6;
const TIMEOUT_MS = 8000;
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; AscendLinkCheck/1.0; +https://ascend-green-delta.vercel.app)",
  Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
};

async function attempt(url: string, method: "HEAD" | "GET"): Promise<LinkVerdict> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { method, headers: HEADERS, redirect: "follow", signal: controller.signal });
    await res.body?.cancel().catch(() => undefined);
    return verdictForStatus(res.status);
  } catch (e) {
    const code = (e as { cause?: { code?: string } })?.cause?.code;
    return verdictForError(code);
  } finally {
    clearTimeout(timer);
  }
}

async function probe(url: string): Promise<LinkVerdict> {
  if (!isPublicHttpUrl(url)) return "unknown";
  const head = await attempt(url, "HEAD");
  if (head === "ok") return head;
  return attempt(url, "GET");
}

export const Route = createFileRoute("/api/public/hooks/link-check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.CRON_SECRET;
        const provided = request.headers.get("x-cron-secret");
        if (!expected || !provided || provided !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: rows, error } = await supabaseAdmin
          .from("opportunities")
          .select("id,url,link_status,link_fail_count")
          .eq("status", "approved")
          .not("url", "is", null)
          .order("link_checked_at", { ascending: true, nullsFirst: true })
          .limit(BATCH_SIZE);
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

        const queue = [...(rows ?? [])];
        const counts: Record<LinkVerdict, number> = { ok: 0, broken: 0, unknown: 0 };
        const worker = async () => {
          for (;;) {
            const row = queue.shift();
            if (!row) return;
            const verdict = await probe(String(row.url));
            counts[verdict]++;
            const next = nextLinkState({ status: row.link_status ?? "unchecked", failCount: row.link_fail_count ?? 0 }, verdict);
            await supabaseAdmin
              .from("opportunities")
              .update({ link_status: next.status, link_fail_count: next.failCount, link_checked_at: new Date().toISOString() })
              .eq("id", row.id);
          }
        };
        await Promise.all(Array.from({ length: CONCURRENCY }, worker));
        return Response.json({ ok: true, checked: (rows ?? []).length, counts });
      },
    },
  },
});
