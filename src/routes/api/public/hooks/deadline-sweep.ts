import { createFileRoute } from "@tanstack/react-router";
import { todayPacific } from "@/lib/dates";

/**
 * Catalog hygiene sweep.
 *
 * A scholarship catalog rots quietly. Deadlines pass, and a student who applies
 * to a program that closed three weeks ago loses time they do not have. This
 * runs on a schedule and does two things:
 *   1. archives approved programs whose deadline is in the past
 *   2. clears the stored matches that pointed at them, so nobody's feed keeps
 *      showing a dead link
 *
 * Authenticated by the project's publishable key in the apikey header, the same
 * contract the digest hook uses.
 */
export const Route = createFileRoute("/api/public/hooks/deadline-sweep")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Authenticated with CRON_SECRET (server-only). Never use the publishable
        // key here: it ships to every browser, so anyone could trigger this sweep.
        const expected = process.env.CRON_SECRET;
        const provided = request.headers.get("x-cron-secret");
        if (!expected || !provided || provided !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { recordEvent, startTimer } = await import("@/lib/observability");
        const done = startTimer();
        const today = todayPacific();

        const { data: expired, error: findErr } = await supabaseAdmin
          .from("opportunities")
          .select("id")
          .eq("status", "approved")
          .not("deadline", "is", null)
          .lt("deadline", today)
          .limit(2000);
        if (findErr) {
          await recordEvent(supabaseAdmin, "catalog_sweep", { ok: false, reason: findErr.message.slice(0, 160) });
          return Response.json({ ok: false, error: findErr.message }, { status: 500 });
        }

        const ids = (expired ?? []).map((o) => o.id);
        if (ids.length) {
          await supabaseAdmin.from("opportunities").update({ status: "archived" }).in("id", ids);
          await supabaseAdmin.from("matches").delete().in("opportunity_id", ids);
        }

        await recordEvent(supabaseAdmin, "catalog_sweep", { duration_ms: done(), ok: true, archived: ids.length });
        return Response.json({ ok: true, archived: ids.length });
      },
    },
  },
});
