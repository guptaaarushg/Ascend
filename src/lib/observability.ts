   
                                              
  
                                                                                
                                                                               
                                                                                
                                                                              
           
   

export type EventName =
  | "match_generation"
  | "ai_call"
  | "ai_call_failed"
  | "ai_fallback_used"
  | "catalog_sweep"
  | "digest_run";

export type EventFields = Record<string, string | number | boolean | null | undefined>;

export function logEvent(event: EventName, fields: EventFields = {}) {
  const line = { ts: new Date().toISOString(), event, ...fields };
  console.log(JSON.stringify(line));
}

                                                             
export function startTimer() {
  const t0 = Date.now();
  return () => Date.now() - t0;
}

   
                                                                         
                                                                    
   
export async function recordEvent(
  client: { from: (t: string) => any } | null,
  event: EventName,
  fields: EventFields = {},
) {
  logEvent(event, fields);
  if (!client) return;
  try {
    await client.from("system_events").insert({
      event,
      duration_ms: typeof fields.duration_ms === "number" ? fields.duration_ms : null,
      ok: fields.ok === undefined ? true : Boolean(fields.ok),
      detail: fields as Record<string, unknown>,
    });
  } catch (e) {
                                                                       
    console.warn("[observability] event persist failed", (e as Error)?.message);
  }
}
