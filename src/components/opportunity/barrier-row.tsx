import { barrierFacts, isZeroBarrier, type BarrierFields } from "@/lib/barriers";

/**
 * "What it actually takes", surfaced on cards and detail pages so the real
 * cost of applying is never buried in a paragraph.
 */
export function BarrierRow({
  opportunity,
  compact = false,
}: {
  opportunity: BarrierFields | null | undefined;
  compact?: boolean;
}) {
  const facts = barrierFacts(opportunity);
  if (!facts.length) return null;
  const zero = isZeroBarrier(opportunity);

  const tones: Record<string, string> = {
    good: "bg-success/10 text-success ring-success/25",
    warn: "bg-primary/10 text-primary ring-primary/25",
    unknown: "bg-muted text-muted-foreground ring-border",
  };

  return (
    <div className={compact ? "mt-3" : "mt-4 rounded-xl border border-primary/12 bg-primary/[0.03] p-4"}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
          What it actually takes
        </span>
        {zero && (
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-success/12 text-success ring-1 ring-success/25">
            $0 barrier
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {facts.map((f) => (
          <span
            key={f.label}
            title={f.label}
            className={`text-[11px] font-medium px-2 py-1 rounded-full ring-1 ${tones[f.tone]}`}
          >
            <span className="opacity-70">{f.label}:</span> {f.value}
          </span>
        ))}
      </div>
    </div>
  );
}
