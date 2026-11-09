import { cn } from "@/lib/utils";

/** Done / in progress / to do as one stacked bar, with the numbers spelled out. */
export function ReleaseProgress({
  counts,
  total,
  className,
}: {
  counts: { todo: number; in_progress: number; done: number };
  total: number;
  className?: string;
}) {
  const pct = (n: number) => (total ? (n / total) * 100 : 0);
  const summary = total
    ? `${counts.done} of ${total} done, ${counts.in_progress} in progress, ${counts.todo} to do`
    : "No issues";
  return (
    <div className={cn("space-y-1", className)}>
      <div
        className="flex h-2 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={summary}
      >
        <div className="bg-status-done" style={{ width: `${pct(counts.done)}%` }} />
        <div className="bg-status-in-progress" style={{ width: `${pct(counts.in_progress)}%` }} />
      </div>
      <p className="text-xs text-muted-foreground tabular-nums">
        {total
          ? `${counts.done}/${total} done${counts.in_progress ? ` · ${counts.in_progress} in progress` : ""}`
          : "No issues"}
      </p>
    </div>
  );
}
