import { cn } from "@/lib/utils";

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const color =
    value >= 90 ? "bg-success" : value >= 70 ? "bg-warning" : "bg-danger";

  return (
    <div className={cn("w-full h-2 bg-surface-alt rounded-full overflow-hidden border border-border", className)}>
      <div
        className={cn("h-full rounded-full transition-all", color)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
