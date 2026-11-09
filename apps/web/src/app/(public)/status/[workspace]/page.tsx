import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  COMPONENT_STATUS_LABELS,
  COMPONENT_STATUS_TONE,
  IMPACT_LABELS,
  IMPACT_TONE,
  INCIDENT_STATUS_LABELS,
  overallStatus,
} from "@/features/public-pages";
import { getPublicStatus } from "@/features/public-pages/server";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Status" };

type Props = PageProps<"/status/[workspace]">;

async function Status({ params }: { params: Props["params"] }) {
  const { workspace } = await params;
  const status = await getPublicStatus(workspace);
  if (!status) notFound();
  const overall = overallStatus(status.components.map((c) => c.status));
  const incidentBlock = (incidents: typeof status.open) =>
    incidents.map((i) => (
      <Card key={i.id} className="gap-3">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <span
              className={cn("size-2.5 rounded-full", IMPACT_TONE[i.impact])}
              aria-hidden="true"
            />
            {i.title}
            <Badge variant="outline">{IMPACT_LABELS[i.impact]}</Badge>
          </CardTitle>
          {i.components.length ? (
            <p className="text-xs text-muted-foreground">
              Affects {i.components.map((c) => c.component.name).join(", ")}
            </p>
          ) : null}
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 border-l pl-4">
            {i.updates.map((u) => (
              <li key={u.id} className="text-sm">
                <p>
                  <span className="font-medium">{INCIDENT_STATUS_LABELS[u.status]}</span>{" "}
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(u.createdAt)}
                  </span>
                </p>
                <p className="whitespace-pre-wrap text-muted-foreground">{u.body}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    ));
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">{status.workspace.name} status</h1>
        <div className="flex items-center gap-3 rounded-xl border p-4" role="status">
          <span className={cn("size-3 rounded-full", overall.tone)} aria-hidden="true" />
          <span className="text-lg font-medium">{overall.label}</span>
        </div>
      </header>
      {status.open.length ? (
        <section className="space-y-3" aria-labelledby="open">
          <h2 id="open" className="font-semibold">
            Current incidents
          </h2>
          {incidentBlock(status.open)}
        </section>
      ) : null}
      <section className="space-y-2" aria-labelledby="components">
        <h2 id="components" className="font-semibold">
          Components
        </h2>
        <ul className="divide-y rounded-xl border">
          {status.components.map((c) => {
            const history = status.history.find((h) => h.componentId === c.id)!;
            return (
              <li key={c.id} className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{c.name}</span>
                  <span className="flex items-center gap-2 text-sm">
                    <span
                      className={cn("size-2.5 rounded-full", COMPONENT_STATUS_TONE[c.status])}
                      aria-hidden="true"
                    />
                    {COMPONENT_STATUS_LABELS[c.status]}
                  </span>
                </div>
                <div className="flex h-7 gap-0.5" aria-label={`${c.name}: last 30 days`} role="img">
                  {history.days.map((d) => (
                    <Tooltip key={d.date}>
                      <TooltipTrigger asChild>
                        <span
                          className={cn(
                            "flex-1 rounded-sm",
                            d.worst ? IMPACT_TONE[d.worst] : COMPONENT_STATUS_TONE.operational,
                            !d.worst && "opacity-70",
                          )}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        {formatDate(d.date)}:{" "}
                        {d.worst ? `${IMPACT_LABELS[d.worst]} incident` : "No incidents"}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
                <p className="flex justify-between text-xs text-muted-foreground">
                  <span>30 days ago</span>
                  <span>{history.uptime}% of days without an incident</span>
                  <span>Today</span>
                </p>
              </li>
            );
          })}
          {!status.components.length ? (
            <li className="p-4 text-sm text-muted-foreground">No components listed.</li>
          ) : null}
        </ul>
      </section>
      <section className="space-y-3" aria-labelledby="past">
        <h2 id="past" className="font-semibold">
          Past incidents (14 days)
        </h2>
        {status.past.length ? (
          incidentBlock(status.past)
        ) : (
          <p className="text-sm text-muted-foreground">No incidents.</p>
        )}
      </section>
    </div>
  );
}

export default function StatusPage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 max-w-3xl" />}>
      <Status params={params} />
    </Suspense>
  );
}
