import { TimeAgo } from "@/components/shared/time-ago";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ApiUsage } from "../server/usage";

const METHOD_TONE: Record<string, string> = {
  GET: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  POST: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  PATCH: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  DELETE: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
};

/** API usage: requests, error rate, latency, a 7-day chart and the latest calls. */
export function ApiUsagePanel({ usage }: { usage: ApiUsage }) {
  const max = Math.max(1, ...usage.days.map((d) => d.ok + d.errors));
  const tiles = [
    { label: "Requests · 24h", value: usage.stats.requests.toLocaleString() },
    { label: "Error rate", value: `${usage.stats.errorRate}%` },
    { label: "p95 latency", value: usage.stats.p95 === null ? "—" : `${usage.stats.p95} ms` },
    { label: "Rate-limited", value: String(usage.stats.rateLimited) },
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="gap-1 py-4">
            <CardContent className="space-y-1 px-4">
              <p className="text-xs text-muted-foreground">{t.label}</p>
              <p className="text-2xl font-semibold tabular-nums">{t.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Requests per day</CardTitle>
            <CardDescription>Last 7 days; errors stacked on top.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-40 items-end gap-3" role="img" aria-label="Requests per day">
              {usage.days.map((d) => (
                <div
                  key={d.date}
                  className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                >
                  <div
                    className="flex w-full flex-1 flex-col justify-end"
                    title={`${d.date}: ${d.ok} ok, ${d.errors} errors`}
                  >
                    <span
                      className="block w-full rounded-t bg-destructive/70"
                      style={{ height: `${(d.errors / max) * 100}%` }}
                    />
                    <span
                      className="block w-full bg-primary"
                      style={{ height: `${(d.ok / max) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(`${d.date}T00:00:00Z`).toLocaleDateString(undefined, {
                      weekday: "short",
                      timeZone: "UTC",
                    })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent requests</CardTitle>
          </CardHeader>
          <CardContent>
            {usage.recent.length ? (
              <ul className="space-y-1.5 text-xs">
                {usage.recent.map((r) => (
                  <li key={r.id} className="flex items-center gap-2">
                    <span
                      className={cn(
                        "w-14 rounded px-1 py-0.5 text-center font-mono font-semibold",
                        METHOD_TONE[r.method] ?? "bg-muted",
                      )}
                    >
                      {r.method}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono" title={`${r.token}`}>
                      {r.path}
                    </span>
                    <span
                      className={cn(
                        "font-mono font-semibold",
                        r.status >= 500
                          ? "text-destructive"
                          : r.status >= 400
                            ? "text-amber-600"
                            : "text-emerald-600",
                      )}
                    >
                      {r.status}
                    </span>
                    <span className="w-14 text-right text-muted-foreground">{r.durationMs}ms</span>
                    <TimeAgo
                      date={r.createdAt}
                      className="hidden w-16 text-right text-muted-foreground sm:inline"
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No API calls yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
