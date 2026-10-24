export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDeadline(value: string | null | undefined): string {
  const d = parseDateOnly(value);
  return d ? d.toLocaleDateString() : "";
}

export function daysUntilDeadline(value: string | null | undefined, now: Date = new Date()): number | null {
  const d = parseDateOnly(value);
  if (!d) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

export function todayPacific(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
