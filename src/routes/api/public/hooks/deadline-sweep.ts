import { createFileRoute } from "@tanstack/react-router";
import { todayPacific } from "@/lib/dates";

   
                         
  
                                                                                
                                                                             
                                          
                                                                
                                                                              
                           
  
                                                                                
                                 
   
export const Route = createFileRoute("/api/public/hooks/deadline-sweep")({
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
