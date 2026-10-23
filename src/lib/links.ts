export function searchHint(o: { title: string; organization?: string | null }): string {
  return [o.title, o.organization, "official application"].filter(Boolean).join(" ");
}

export function googleSearchUrl(hint: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(hint)}`;
}

export function hostOf(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
