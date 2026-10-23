import { describe, it, expect } from "vitest";
import { isPublicHttpUrl, nextLinkState, verdictForError, verdictForStatus } from "@/lib/link-health";
import { googleSearchUrl, hostOf, searchHint } from "@/lib/links";

describe("verdicts", () => {
  it("treats 2xx and 3xx as working", () => {
    expect(verdictForStatus(200)).toBe("ok");
    expect(verdictForStatus(301)).toBe("ok");
  });
  it("treats 404 and 410 as broken", () => {
    expect(verdictForStatus(404)).toBe("broken");
    expect(verdictForStatus(410)).toBe("broken");
  });
  it("does not blame the link when a site blocks bots or is down", () => {
    for (const code of [401, 403, 429, 500, 503, 999]) expect(verdictForStatus(code)).toBe("unknown");
  });
  it("treats unresolvable hosts as broken and other network errors as unknown", () => {
    expect(verdictForError("ENOTFOUND")).toBe("broken");
    expect(verdictForError("ETIMEDOUT")).toBe("unknown");
    expect(verdictForError(undefined)).toBe("unknown");
  });
});

describe("nextLinkState", () => {
  it("needs two broken results in a row before marking a link broken", () => {
    const first = nextLinkState({ status: "unchecked", failCount: 0 }, "broken");
    expect(first.status).toBe("unchecked");
    const second = nextLinkState({ status: first.status, failCount: first.failCount }, "broken");
    expect(second.status).toBe("broken");
  });
  it("resets after a working check", () => {
    expect(nextLinkState({ status: "broken", failCount: 3 }, "ok")).toEqual({ status: "ok", failCount: 0 });
  });
  it("keeps a good status through an unknown result", () => {
    expect(nextLinkState({ status: "ok", failCount: 0 }, "unknown").status).toBe("ok");
    expect(nextLinkState({ status: "unchecked", failCount: 0 }, "unknown").status).toBe("unknown");
  });
});

describe("isPublicHttpUrl", () => {
  it("allows normal public sites", () => {
    expect(isPublicHttpUrl("https://www.usaco.org/")).toBe(true);
  });
  it("rejects private, local, and non-http addresses", () => {
    for (const u of ["http://localhost/x", "http://127.0.0.1/", "http://10.0.0.5/", "http://192.168.1.1/", "http://169.254.169.254/", "ftp://example.com", "not a url"]) {
      expect(isPublicHttpUrl(u)).toBe(false);
    }
  });
});

describe("link helpers", () => {
  it("builds a search hint and Google URL", () => {
    const hint = searchHint({ title: "USACO", organization: "Clemson" });
    expect(hint).toBe("USACO Clemson official application");
    expect(googleSearchUrl(hint)).toContain("q=USACO%20Clemson");
  });
  it("reads the host from a URL", () => {
    expect(hostOf("https://www.usaco.org/index.php")).toBe("usaco.org");
    expect(hostOf(null)).toBe("");
  });
});
