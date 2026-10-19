/**
 * Structured logging and lightweight metrics.
 *
 * Everything the pipeline does emits one JSON line with a stable shape, so logs
 * are greppable and countable instead of prose. Counters are also persisted to
 * public.system_events, which is what the admin health panel reads. Persistence
 * is best effort on purpose: telemetry must never be able to fail a student's
 * request.
 */

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

/** Simple in-request timer, returns elapsed milliseconds. */
export function startTimer() {
  const t0 = Date.now();
  return () => Date.now() - t0;
}

/**
 * Persist one event row for the health dashboard. Callers pass their own
 * Supabase client so this module stays free of server-only imports.
 */
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
    // Telemetry is never allowed to break the request it is measuring.
    console.warn("[observability] event persist failed", (e as Error)?.message);
  }
}
