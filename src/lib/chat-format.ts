const isRow = (line: string) => /^\s*\|.*\|\s*$/.test(line);
const isSeparator = (line: string) => isRow(line) && /^[\s|:-]+$/.test(line) && line.includes("-");
const cells = (line: string) =>
  line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

export function tablesToLists(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (isRow(lines[i]) && i + 1 < lines.length && isSeparator(lines[i + 1])) {
      const header = cells(lines[i]);
      i += 2;
      while (i < lines.length && isRow(lines[i]) && !isSeparator(lines[i])) {
        const row = cells(lines[i]);
        const rest = row
          .slice(1)
          .map((value, k) => (value && header[k + 1] ? `${header[k + 1]}: ${value}` : value))
          .filter(Boolean);
        const first = row[0] ? `**${row[0].replace(/\*\*/g, "")}**` : "";
        out.push(`- ${first}${first && rest.length ? " - " : ""}${rest.join(" | ")}`.trimEnd());
        i++;
      }
      out.push("");
      continue;
    }
    out.push(lines[i]);
    i++;
  }
  return out.join("\n");
}
