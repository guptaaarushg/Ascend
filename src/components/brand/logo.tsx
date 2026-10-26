import { cn } from "@/lib/utils";

   
                                                                        
                                         
   
export function Logo({
  className,
  showWordmark = true,
  size = "md",
  tone = "default",
}: {
  className?: string;
  showWordmark?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  tone?: "default" | "inverse";
}) {
  const text =
    size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : size === "xl" ? "text-5xl" : "text-lg";
  const color =
    tone === "inverse" ? "text-primary-foreground" : "text-foreground";

  return (
    <span className={cn("inline-flex items-baseline", color, className)}>
      {showWordmark && (
        <span
          className={cn(
            "font-serif font-semibold tracking-tight leading-none",
            text,
          )}
        >
          Ascend
        </span>
      )}
    </span>
  );
}
