import {
  type IssueType,
  ISSUE_TYPE_LABELS,
  type LabelColor,
  type Priority,
  PRIORITY_LABELS,
  type StatusCategory,
} from "@tracklane/core";
import {
  BookmarkIcon,
  BugIcon,
  ChevronDownIcon,
  ChevronsDownIcon,
  ChevronsUpIcon,
  ChevronUpIcon,
  EqualIcon,
  ListTreeIcon,
  type LucideIcon,
  SquareCheckIcon,
  ZapIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const TYPE_STYLE: Record<IssueType, { icon: LucideIcon; className: string }> = {
  story: { icon: BookmarkIcon, className: "bg-emerald-500 text-white" },
  task: { icon: SquareCheckIcon, className: "bg-sky-500 text-white" },
  bug: { icon: BugIcon, className: "bg-red-500 text-white" },
  epic: { icon: ZapIcon, className: "bg-violet-500 text-white" },
  subtask: { icon: ListTreeIcon, className: "bg-cyan-600 text-white" },
};

/** Coloured issue-type glyph. Pass `tooltip={false}` inside menus/selects that already show the name. */
export function IssueTypeIcon({
  type,
  className,
  tooltip = true,
}: {
  type: IssueType;
  className?: string;
  tooltip?: boolean;
}) {
  const { icon: Icon, className: tone } = TYPE_STYLE[type];
  const glyph = (
    <span
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-[4px]",
        tone,
        className,
      )}
      aria-hidden={tooltip ? undefined : true}
    >
      <Icon className="size-3" aria-hidden="true" strokeWidth={2.5} />
      {tooltip ? <span className="sr-only">{ISSUE_TYPE_LABELS[type]}</span> : null}
    </span>
  );
  if (!tooltip) return glyph;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{glyph}</TooltipTrigger>
      <TooltipContent>{ISSUE_TYPE_LABELS[type]}</TooltipContent>
    </Tooltip>
  );
}

const PRIORITY_STYLE: Record<Priority, { icon: LucideIcon; className: string }> = {
  highest: { icon: ChevronsUpIcon, className: "text-red-600 dark:text-red-400" },
  high: { icon: ChevronUpIcon, className: "text-orange-500" },
  medium: { icon: EqualIcon, className: "text-amber-500" },
  low: { icon: ChevronDownIcon, className: "text-sky-500" },
  lowest: { icon: ChevronsDownIcon, className: "text-sky-400" },
};

export function PriorityIcon({
  priority,
  className,
  tooltip = true,
}: {
  priority: Priority;
  className?: string;
  tooltip?: boolean;
}) {
  const { icon: Icon, className: tone } = PRIORITY_STYLE[priority];
  const glyph = (
    <span
      className={cn("inline-flex shrink-0", tone, className)}
      aria-hidden={tooltip ? undefined : true}
    >
      <Icon className="size-4" aria-hidden="true" strokeWidth={2.5} />
      {tooltip ? <span className="sr-only">{PRIORITY_LABELS[priority]} priority</span> : null}
    </span>
  );
  if (!tooltip) return glyph;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{glyph}</TooltipTrigger>
      <TooltipContent>{PRIORITY_LABELS[priority]} priority</TooltipContent>
    </Tooltip>
  );
}

const STATUS_STYLE: Record<StatusCategory, string> = {
  todo: "bg-muted text-muted-foreground",
  in_progress: "bg-status-in-progress/12 text-status-in-progress",
  done: "bg-status-done/12 text-status-done",
};

export function StatusBadge({
  status,
  className,
}: {
  status: { name: string; category: StatusCategory };
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "h-5 rounded px-1.5 text-[11px] font-semibold tracking-wide uppercase",
        STATUS_STYLE[status.category],
        className,
      )}
    >
      {status.name}
    </Badge>
  );
}

const LABEL_STYLE: Record<LabelColor, string> = {
  gray: "bg-zinc-500/12 text-zinc-700 dark:text-zinc-300",
  red: "bg-red-500/12 text-red-700 dark:text-red-300",
  orange: "bg-orange-500/12 text-orange-700 dark:text-orange-300",
  amber: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  green: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  teal: "bg-teal-500/12 text-teal-700 dark:text-teal-300",
  blue: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  violet: "bg-violet-500/12 text-violet-700 dark:text-violet-300",
  pink: "bg-pink-500/12 text-pink-700 dark:text-pink-300",
};

export const LABEL_SWATCH: Record<LabelColor, string> = {
  gray: "bg-zinc-500",
  red: "bg-red-500",
  orange: "bg-orange-500",
  amber: "bg-amber-500",
  green: "bg-emerald-500",
  teal: "bg-teal-500",
  blue: "bg-sky-500",
  violet: "bg-violet-500",
  pink: "bg-pink-500",
};

export function LabelBadge({ label }: { label: { name: string; color: string } }) {
  const tone = LABEL_STYLE[label.color as LabelColor] ?? LABEL_STYLE.gray;
  return (
    <Badge variant="secondary" className={cn("h-5 rounded px-1.5", tone)}>
      {label.name}
    </Badge>
  );
}
