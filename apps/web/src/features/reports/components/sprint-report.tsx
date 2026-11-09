import type { IssueType, Priority, StatusCategory } from "@tracklane/core";
import type { Route } from "next";
import Link from "next/link";
import { UserAvatar } from "@/components/shared/user-avatar";
import { IssueTypeIcon, PriorityIcon, StatusBadge } from "@/features/issues";
import { cn } from "@/lib/utils";
import { APP_LOCALE } from "@/config/locale";

export interface SprintReportData {
  committed: { points: number | null; issues: number | null };
  completed: { points: number; issues: number };
  open: { points: number; issues: number };
  scopeAdded: number;
  forecast: string | null;
  end: string | null;
  notCompleted: {
    id: string;
    key: string;
    title: string;
    type: IssueType;
    priority: Priority;
    estimate: number | null;
    status: { name: string; category: StatusCategory };
    assignee: { name: string; image: string | null } | null;
  }[];
}

const fmt = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString(APP_LOCALE, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

/** Sprint report tiles and the issues not completed. `unit` switches points ↔ issue counts. */
export function SprintReportView({
  slug,
  report,
  unit,
  unitHref,
}: {
  slug: string;
  report: SprintReportData;
  unit: "points" | "issues";
  unitHref: (unit: "points" | "issues") => string;
}) {
  const v = (x: { points: number | null; issues: number | null }) =>
    unit === "points" ? x.points : x.issues;
  const committed =
    v(report.committed) ??
    (unit === "issues" ? report.completed.issues + report.open.issues : null);
  const completed = v(report.completed)!;
  const rate = committed ? Math.round((completed / committed) * 100) : null;
  const late = report.forecast && report.end && report.forecast > report.end;
  const tiles = [
    { label: "Committed", value: committed ?? "—" },
    { label: "Completed", value: completed, hint: rate !== null ? `${rate}%` : undefined },
    { label: "Not completed", value: v(report.open) },
    { label: "Added mid-sprint", value: unit === "points" ? `+${report.scopeAdded}` : "—" },
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Measure">
          {(["points", "issues"] as const).map((u) => (
            <Link
              key={u}
              href={unitHref(u) as Route}
              scroll={false}
              aria-pressed={u === unit}
              className={cn(
                "rounded px-2.5 py-0.5 text-sm capitalize",
                u === unit ? "bg-secondary font-medium" : "text-muted-foreground",
              )}
            >
              {u === "points" ? "Story points" : "Issue count"}
            </Link>
          ))}
        </div>
        {report.forecast ? (
          <p className={cn("text-sm", late ? "text-destructive" : "text-muted-foreground")}>
            Forecast: done by {fmt(report.forecast)}
            {report.end ? ` (ends ${fmt(report.end)})` : ""}
          </p>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border px-3 py-2.5">
            <p className="text-xs text-muted-foreground">{t.label}</p>
            <p className="text-xl font-semibold tabular-nums">
              {t.value}
              {t.hint ? (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">{t.hint}</span>
              ) : null}
            </p>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Not completed ({report.notCompleted.length})</h3>
        {report.notCompleted.length ? (
          <ul className="divide-y rounded-lg border">
            {report.notCompleted.map((i) => (
              <li key={i.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <IssueTypeIcon type={i.type} />
                <Link
                  href={`/${slug}/issues/${i.key}` as Route}
                  className="font-mono text-xs text-muted-foreground hover:underline"
                >
                  {i.key}
                </Link>
                <span className="min-w-0 flex-1 truncate">{i.title}</span>
                <StatusBadge status={i.status} />
                <PriorityIcon priority={i.priority} />
                <span className="w-8 text-right text-xs tabular-nums">{i.estimate ?? "–"}</span>
                {i.assignee ? <UserAvatar user={i.assignee} /> : <span className="size-6" />}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Everything in the sprint is done.</p>
        )}
      </div>
    </div>
  );
}
