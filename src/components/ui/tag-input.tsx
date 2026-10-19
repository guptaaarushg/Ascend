import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { containsProfanity, FAMILY_FRIENDLY_MESSAGE } from "@/lib/profanity";
import { toast } from "sonner";

interface TagInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  className?: string;
  autoCapitalize?: boolean;
  id?: string;
}

function titleCase(s: string) {
  return s
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ")
    .trim();
}

export function TagInput({
  value,
  onChange,
  placeholder = "Type and press Enter…",
  className,
  autoCapitalize = true,
  id,
}: TagInputProps) {
  const [draft, setDraft] = React.useState("");

  const commit = (raw: string) => {
    const cleaned = raw.trim().replace(/,+$/, "").trim();
    if (!cleaned) return;
    if (containsProfanity(cleaned)) {
      toast.error(FAMILY_FRIENDLY_MESSAGE);
      setDraft("");
      return;
    }
    const formatted = autoCapitalize ? titleCase(cleaned) : cleaned;
    if (value.some((v) => v.toLowerCase() === formatted.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, formatted]);
    setDraft("");
  };

  const remove = (idx: number) => {
    const next = [...value];
    next.splice(idx, 1);
    onChange(next);
  };

  return (
    <div
      className={cn(
        "flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5 text-sm shadow-sm focus-within:ring-1 focus-within:ring-ring",
        className,
      )}
      onClick={(e) => {
        const target = e.currentTarget.querySelector("input");
        target?.focus();
      }}
    >
      {value.map((tag, i) => (
        <span
          key={`${tag}-${i}`}
          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary ring-1 ring-primary/20 transition-colors"
        >
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            onClick={(e) => {
              e.stopPropagation();
              remove(i);
            }}
            className="rounded-full p-0.5 hover:bg-primary/20 transition-colors"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => {
          const v = e.target.value;
          if (v.includes(",")) {
            v.split(",").forEach(commit);
          } else {
            setDraft(v);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Tab") {
            if (draft.trim()) {
              e.preventDefault();
              commit(draft);
            }
          } else if (e.key === "Backspace" && !draft && value.length > 0) {
            remove(value.length - 1);
          }
        }}
        onBlur={() => draft.trim() && commit(draft)}
        placeholder={value.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[8ch] bg-transparent outline-none placeholder:text-muted-foreground py-0.5"
      />
    </div>
  );
}
