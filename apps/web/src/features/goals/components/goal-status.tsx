import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type GoalStatus = "on_track" | "at_risk" | "off_track" | "done";

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  on_track: "On track",
  at_risk: "At risk",
  off_track: "Off track",
  done: "Done",
};

const TONE: Record<GoalStatus, string> = {
  on_track: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  at_risk: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  off_track: "bg-red-500/12 text-red-700 dark:text-red-300",
  done: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
};

export function GoalStatusBadge({ status, className }: { status: GoalStatus; className?: string }) {
  return (
    <Badge variant="secondary" className={cn(TONE[status], className)}>
      {GOAL_STATUS_LABELS[status]}
    </Badge>
  );
}

/** Thin progress bar with the count beside it. */
export function GoalProgress({ progress }: { progress: { done: number; total: number } }) {
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progress"
      >
        <div className="h-full bg-status-done" style={{ width: `${pct}%` }} />
      </div>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {progress.total ? `${progress.done}/${progress.total} · ${pct}%` : "No issues"}
      </span>
    </div>
  );
}
