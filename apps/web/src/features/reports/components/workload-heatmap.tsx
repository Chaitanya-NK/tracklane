import type { Route } from "next";
import Link from "next/link";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { WorkloadPlan } from "../server/queries";
import { DAILY_CAPACITY, type WorkloadMetric } from "../workload-plan";

const UNIT: Record<WorkloadMetric, string> = { hours: "h", points: " pts", issues: "" };

function shade(value: number, max: number, over: boolean) {
  if (over) return "bg-red-500/80 text-white dark:bg-red-600";
  if (!value) return "bg-muted/40 text-muted-foreground/60";
  const ratio = value / max;
  if (ratio > 0.85) return "bg-blue-600 text-white dark:bg-blue-500";
  if (ratio > 0.6) return "bg-blue-500/70 text-white";
  if (ratio > 0.35) return "bg-blue-400/40";
  return "bg-blue-300/25";
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
  tone?: "bad";
}) {
  return (
    <Card className={cn("gap-1 py-4", tone === "bad" && "border-destructive/40 bg-destructive/5")}>
      <CardContent className="space-y-1 px-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

/**
 * Who has how much scheduled work each working day: issue estimates spread from start (or
 * today) to due date. Red cells are over 8 hours; hatched cells are time off.
 */
export function WorkloadHeatmap({
  slug,
  plan,
  days,
  metric,
  href,
}: {
  slug: string;
  plan: WorkloadPlan;
  days: string[];
  metric: WorkloadMetric;
  href: (patch: { metric?: WorkloadMetric; weeks?: number; shift?: number }) => string;
}) {
  const capacity = DAILY_CAPACITY[metric];
  const max = Math.max(capacity ?? 0, 1, ...plan.rows.flatMap((r) => r.cells.map((c) => c.value)));
  const fmt = (v: number) => (v ? `${v}${UNIT[metric]}` : "");
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Utilization"
          value={plan.stats.utilization === null ? "—" : `${plan.stats.utilization}%`}
          hint={capacity ? `of ${capacity}h a day, time off excluded` : "Switch to hours to see it"}
        />
        <Tile
          label="Over capacity"
          value={String(plan.stats.overCapacity)}
          hint="people with an overloaded day"
          tone={plan.stats.overCapacity ? "bad" : undefined}
        />
        <Tile
          label="Unassigned"
          value={String(plan.unassigned.issues)}
          hint={`open issues · ${plan.unassigned.total}${UNIT[metric]} of work`}
        />
        <Tile
          label="Time off"
          value={String(plan.stats.onTimeOff)}
          hint="people away in this range"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Measure">
          {(["hours", "points", "issues"] as const).map((m) => (
            <Link
              key={m}
              href={href({ metric: m }) as Route}
              aria-pressed={m === metric}
              className={cn(
                "rounded px-2.5 py-1 text-sm capitalize",
                m === metric
                  ? "bg-secondary font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m}
            </Link>
          ))}
        </div>
        <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Range">
          {[1, 2, 4].map((w) => (
            <Link
              key={w}
              href={href({ weeks: w }) as Route}
              aria-pressed={days.length === w * 5}
              className={cn(
                "rounded px-2.5 py-1 text-sm",
                days.length === w * 5
                  ? "bg-secondary font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {w} week{w > 1 ? "s" : ""}
            </Link>
          ))}
        </div>
        <span className="ml-auto flex gap-1 text-sm">
          <Link
            href={href({ shift: -1 }) as Route}
            className="rounded border px-2 py-1 hover:bg-muted"
          >
            ← Earlier
          </Link>
          <Link
            href={href({ shift: 0 }) as Route}
            className="rounded border px-2 py-1 hover:bg-muted"
          >
            Today
          </Link>
          <Link
            href={href({ shift: 1 }) as Route}
            className="rounded border px-2 py-1 hover:bg-muted"
          >
            Later →
          </Link>
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm" aria-label="Workload by day">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="sticky left-0 bg-muted/50 px-3 py-2 text-left font-medium">Person</th>
              {days.map((d) => {
                const date = new Date(`${d}T00:00:00Z`);
                return (
                  <th key={d} className="min-w-12 px-0.5 py-2 text-center font-medium">
                    {date.toLocaleDateString(undefined, { weekday: "narrow", timeZone: "UTC" })}
                    <br />
                    <span className="text-foreground">{date.getUTCDate()}</span>
                  </th>
                );
              })}
              <th className="px-3 py-2 text-right font-medium">Total</th>
              <th className="px-3 py-2 text-right font-medium">No due date</th>
            </tr>
          </thead>
          <tbody>
            {plan.rows.map((row) => (
              <tr key={row.user.id} className="border-t">
                <td className="sticky left-0 bg-background px-3 py-1.5">
                  <Link
                    href={
                      `/${slug}/filters?${new URLSearchParams({ q: `assignee = "${row.user.name}" AND statusCategory != done ORDER BY due ASC` })}` as Route
                    }
                    className="flex items-center gap-2 whitespace-nowrap hover:underline"
                  >
                    <UserAvatar user={row.user} />
                    {row.user.name}
                  </Link>
                </td>
                {row.cells.map((cell, i) => (
                  <td key={days[i]} className="p-0.5">
                    <span
                      title={cell.off ? "Time off" : `${cell.value}${UNIT[metric]}`}
                      className={cn(
                        "flex h-8 items-center justify-center rounded text-xs tabular-nums",
                        cell.off
                          ? "bg-[repeating-linear-gradient(45deg,var(--muted),var(--muted)_4px,transparent_4px,transparent_8px)] text-muted-foreground"
                          : shade(cell.value, max, cell.over),
                      )}
                    >
                      {cell.off ? "Off" : fmt(cell.value)}
                    </span>
                  </td>
                ))}
                <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                  {fmt(row.total) || "—"}
                </td>
                <td className="px-3 py-1.5 text-right text-muted-foreground tabular-nums">
                  {fmt(row.unscheduled) || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Estimates are spread over working days from each issue&apos;s start (or today) to its due
        date; overdue work lands on the first day.
      </p>
    </div>
  );
}
