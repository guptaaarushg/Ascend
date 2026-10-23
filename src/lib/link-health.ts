export type LinkVerdict = "ok" | "broken" | "unknown";

export type LinkState = { status: string; failCount: number };

export function verdictForStatus(status: number): LinkVerdict {
  if (status >= 200 && status < 400) return "ok";
  if (status === 404 || status === 410) return "broken";
  return "unknown";
}

export function verdictForError(code: string | undefined): LinkVerdict {
  return code === "ENOTFOUND" || code === "ERR_NAME_NOT_RESOLVED" ? "broken" : "unknown";
}

export function isPublicHttpUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (host.startsWith("[")) return false;
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 10 || a === 127 || a === 0) return false;
    if (a === 169 && b === 254) return false;
    if (a === 192 && b === 168) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
  }
  return true;
}

export function nextLinkState(prev: LinkState, verdict: LinkVerdict): LinkState {
  if (verdict === "ok") return { status: "ok", failCount: 0 };
  if (verdict === "broken") {
    const failCount = prev.failCount + 1;
    return { status: failCount >= 2 ? "broken" : prev.status, failCount };
  }
  return { status: prev.status === "unchecked" ? "unknown" : prev.status, failCount: prev.failCount };
}
