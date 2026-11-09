import { formatElapsed, type Priority } from "@tracklane/core";
import { CheckIcon, ClockIcon, TimerIcon, XIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PriorityIcon } from "@/features/issues";
import { cn } from "@/lib/utils";
import type { SlaClock, SlaOverview as Overview } from "../server/evaluate";

const TONE = {
  breached: { bar: "bg-destructive", text: "text-destructive" },
  at_risk: { bar: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" },
  running: { bar: "bg-primary", text: "text-foreground" },
  met: { bar: "bg-emerald-600", text: "text-emerald-700 dark:text-emerald-400" },
  missed: { bar: "bg-destructive", text: "text-destructive" },
} as const;

function clockLabel(clock: SlaClock) {
  switch (clock.state) {
    case "met":
      return `Met · ${formatElapsed(clock.elapsedMinutes)}`;
    case "missed":
      return `Missed by ${formatElapsed(-clock.remainingMinutes)}`;
    case "breached":
      return `Breached ${formatElapsed(-clock.remainingMinutes)}`;
    default:
      return `${formatElapsed(clock.remainingMinutes)} left`;
  }
}

function ClockCell({ clock, bar }: { clock: SlaClock | null; bar?: boolean }) {
  if (!clock) return <span className="text-sm text-muted-foreground">—</span>;
  const tone = TONE[clock.state];
  const pct = Math.min(100, Math.max(0, (clock.elapsedMinutes / clock.targetMinutes) * 100));
  const Icon =
    clock.state === "met"
      ? CheckIcon
      : clock.state === "running" || clock.state === "at_risk"
        ? ClockIcon
        : XIcon;
  return (
    <span className="flex items-center gap-3" title={clock.policyName}>
      {bar ? (
        <span className="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-muted">
          <span className={cn("block h-full", tone.bar)} style={{ width: `${pct}%` }} />
        </span>
      ) : null}
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap",
          tone.text,
        )}
      >
        <Icon className="size-3.5" aria-hidden="true" />
        {clockLabel(clock)}
      </span>
    </span>
  );
}

function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "bad" | "warn";
}) {
  return (
    <Card
      className={cn(
        "gap-1 py-4",
        tone === "bad" && "border-destructive/40 bg-destructive/5",
        tone === "warn" &&
          "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40",
      )}
    >
      <CardContent className="space-y-1 px-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

/** Teams → SLAs: live timers across projects, worst first, with each project's policy. */
export function SlaOverview({ slug, overview }: { slug: string; overview: Overview }) {
  const { stats, rows, policies } = overview;
  if (policies.length === 0) {
    return (
      <EmptyState
        icon={TimerIcon}
        title="No SLAs yet"
        description="Add response and resolution targets in a project's settings → SLAs."
      />
    );
  }
  return (
    <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
      <div className="min-w-0 flex-1 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile
            label="Met (last 30 days)"
            value={stats.metRate === null ? "—" : `${stats.metRate}%`}
            hint="of finished clocks"
          />
          <Tile
            label="Breached now"
            value={String(stats.breached)}
            hint="open clocks past target"
            tone={stats.breached ? "bad" : undefined}
          />
          <Tile
            label="At risk"
            value={String(stats.atRisk)}
            hint="inside the warning window"
            tone={stats.atRisk ? "warn" : undefined}
          />
          <Tile
            label="Median first response"
            value={
              stats.medianFirstResponse === null ? "—" : formatElapsed(stats.medianFirstResponse)
            }
            hint="last 30 days"
          />
        </div>
        {rows.length === 0 ? (
          <EmptyState
            icon={CheckIcon}
            title="All clear"
            description="No open issue has a running SLA clock."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">P</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead className="w-44">First response</TableHead>
                  <TableHead className="w-72">Time to resolve</TableHead>
                  <TableHead className="w-40">Assignee</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const bad =
                    row.firstResponse?.state === "breached" || row.resolution?.state === "breached";
                  return (
                    <TableRow key={row.issueId} className={cn(bad && "bg-destructive/5")}>
                      <TableCell>
                        <PriorityIcon priority={row.priority as Priority} />
                      </TableCell>
                      <TableCell className="max-w-0">
                        <Link
                          href={`/${slug}/issues/${row.key}` as Route}
                          className="flex min-w-0 gap-2 hover:underline"
                        >
                          <span className="font-mono text-xs text-muted-foreground">{row.key}</span>
                          <span className="truncate font-medium">{row.title}</span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <ClockCell clock={row.firstResponse} />
                      </TableCell>
                      <TableCell>
                        <ClockCell clock={row.resolution} bar />
                      </TableCell>
                      <TableCell>
                        {row.assignee ? (
                          <span className="flex items-center gap-2 text-sm">
                            <UserAvatar user={row.assignee} />
                            <span className="truncate">{row.assignee.name}</span>
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      <Card className="w-full xl:w-80">
        <CardHeader>
          <CardTitle className="text-base">Policies</CardTitle>
          <CardDescription>
            Clocks run in calendar time and are checked every 5 minutes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {policies.map((p) => (
            <div key={p.id} className="space-y-0.5 rounded-md border px-3 py-2 text-sm">
              <p className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{p.name}</span>
                <span className="font-mono text-xs">{formatElapsed(p.targetMinutes)}</span>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {p.project} · {p.metric === "first_response" ? "First response" : "Resolution"} ·
                warn {formatElapsed(p.warnMinutes)} before
              </p>
              <Link
                href={`/${slug}/projects/${p.projectKey}/settings/slas` as Route}
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                Edit
              </Link>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
