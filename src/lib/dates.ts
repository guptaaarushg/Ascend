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

export type PlanYear = { year: number; schoolYear: string; stage: string | null };

function ordinal(n: number): string {
  return `${n}th`;
}

export function parseSeniorStart(applicationText: string | null | undefined): number | null {
  if (!applicationText) return null;
  const m = /(20\d{2})/.exec(applicationText);
  if (!m) return null;
  const year = Number(m[1]);
  return /class of|graduat/i.test(applicationText) ? year - 1 : year;
}

export function gradeFromText(text: string | null | undefined): number | null {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/freshman/.test(t)) return 9;
  if (/sophomore/.test(t)) return 10;
  if (/junior/.test(t)) return 11;
  if (/senior/.test(t)) return 12;
  const m = /\b(9|10|11|12)(?:st|nd|rd|th)?\b/.exec(t);
  return m ? Number(m[1]) : null;
}

export function buildSchoolYearPlan(opts: {
  today: string;
  years: number;
  eduLevel: string;
  applicationText?: string | null;
  educationText?: string | null;
}): PlanYear[] {
  const [y, mo] = opts.today.split("-").map(Number);
  const startYear = mo >= 8 ? y : y - 1;
  let seniorStart: number | null = null;
  if (opts.eduLevel === "high_school") {
    seniorStart = parseSeniorStart(opts.applicationText);
    if (seniorStart === null) {
      const grade = gradeFromText(opts.educationText);
      if (grade !== null) seniorStart = startYear + (12 - grade);
    }
  }
  return Array.from({ length: opts.years }, (_, i) => {
    const ys = startYear + i;
    const schoolYear = `${ys}-${String((ys + 1) % 100).padStart(2, "0")}`;
    let stage: string | null = null;
    if (seniorStart !== null) {
      const diff = seniorStart - ys;
      if (diff >= 0) {
        const grade = 12 - diff;
        stage = grade >= 9 ? `${ordinal(grade)} grade` : grade >= 6 ? `${ordinal(grade)} grade` : "before high school";
      } else {
        const collegeYear = -diff;
        stage = collegeYear <= 4 ? `college year ${collegeYear}` : "after college year 4";
      }
    }
    return { year: i + 1, schoolYear, stage };
  });
}
