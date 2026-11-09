import { formatElapsed, SLA_STATE_LABELS, type SlaState } from "@tracklane/core";
import { CheckCircle2Icon, CircleAlertIcon, ClockIcon, XCircleIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const STYLE: Record<SlaState, string> = {
  running: "bg-muted text-foreground",
  at_risk: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  breached: "bg-destructive/15 text-destructive",
  met: "bg-status-done/15 text-status-done",
  missed: "bg-destructive/10 text-destructive",
};
const ICON = {
  running: ClockIcon,
  at_risk: CircleAlertIcon,
  breached: XCircleIcon,
  met: CheckCircle2Icon,
  missed: XCircleIcon,
};

/** One SLA's state on an issue: "At risk · 45m left", "Breached · 2h over", "Met". */
export function SlaChip({
  name,
  state,
  remainingMinutes,
  dueAt,
}: {
  name: string;
  state: SlaState;
  remainingMinutes: number;
  dueAt: Date;
}) {
  const Icon = ICON[state];
  const detail =
    state === "running" || state === "at_risk"
      ? `${formatElapsed(remainingMinutes)} left`
      : state === "breached"
        ? `${formatElapsed(-remainingMinutes)} over`
        : state === "missed"
          ? `by ${formatElapsed(-remainingMinutes)}`
          : `${formatElapsed(remainingMinutes)} early`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium",
            STYLE[state],
          )}
          aria-label={`${name}: ${SLA_STATE_LABELS[state]}, ${detail}`}
        >
          <Icon className="size-3.5" aria-hidden="true" />
          {SLA_STATE_LABELS[state]} · {detail}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {name} — due {dueAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
      </TooltipContent>
    </Tooltip>
  );
}
