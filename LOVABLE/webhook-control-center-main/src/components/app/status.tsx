import { cn } from "@/lib/utils";

export type Tone = "neutral" | "success" | "warning" | "destructive" | "muted";

export function StatusDot({ tone = "neutral", className }: { tone?: Tone; className?: string }) {
  const map: Record<Tone, string> = {
    neutral: "bg-foreground",
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
    muted: "bg-muted-foreground/50",
  };
  return <span className={cn("inline-block h-1.5 w-1.5 rounded-full", map[tone], className)} />;
}

export function StatusBadge({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: React.ReactNode;
}) {
  const map: Record<Tone, string> = {
    neutral: "border-border bg-surface text-foreground",
    success: "border-success/30 bg-success/10 text-success",
    warning: "border-warning/40 bg-warning/15 text-foreground",
    destructive: "border-destructive/30 bg-destructive/10 text-destructive",
    muted: "border-border bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1.5 rounded-md border px-1.5 text-[11px] font-medium",
        map[tone],
      )}
    >
      <StatusDot tone={tone} />
      {children}
    </span>
  );
}
