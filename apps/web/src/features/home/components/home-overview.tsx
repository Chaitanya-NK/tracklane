import { CircleCheckIcon, CircleDashedIcon } from "lucide-react";
import { type ReactNode, Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { CURRENT_PHASE, roadmap } from "../data/roadmap";
import { SystemStatus } from "./system-status";

/** The workspace home. `header` streams in separately because it reads the session. */
export function HomeOverview({
  header,
  stats,
  assigned,
  approvals,
}: {
  header: ReactNode;
  stats: ReactNode;
  assigned: ReactNode;
  /** Pending approvals for the user; renders nothing when there are none. */
  approvals?: ReactNode;
}) {
  const done = roadmap.filter((p) => p.phase <= CURRENT_PHASE).length;
  const percent = Math.round((done / roadmap.length) * 100);

  return (
    <div className="space-y-6">
      {header}

      {stats}

      {approvals}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Assigned to me</CardTitle>
            <CardDescription>Open issues you own, soonest due first.</CardDescription>
          </CardHeader>
          <CardContent>{assigned}</CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System status</CardTitle>
              <CardDescription>Local services for this environment.</CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<Skeleton className="h-6 w-full" />}>
                <SystemStatus />
              </Suspense>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Build progress</CardTitle>
              <CardDescription>
                Phase {CURRENT_PHASE} of {roadmap.at(-1)!.phase} complete
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={percent} aria-label="Build progress" />
              <ol className="space-y-2.5">
                {roadmap.map((phase) => {
                  const complete = phase.phase <= CURRENT_PHASE;
                  return (
                    <li key={phase.phase} className="flex gap-2.5 text-sm">
                      {complete ? (
                        <CircleCheckIcon
                          className="mt-0.5 size-4 shrink-0 text-status-done"
                          aria-label="Done"
                        />
                      ) : (
                        <CircleDashedIcon
                          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                          aria-label="Planned"
                        />
                      )}
                      <span>
                        <span className={complete ? "font-medium" : ""}>
                          {phase.phase}. {phase.title}
                        </span>
                        <span className="block text-xs text-muted-foreground">{phase.summary}</span>
                        {phase.carryOver?.length && !complete ? (
                          <span className="mt-1 block text-xs text-muted-foreground">
                            <span className="font-medium text-foreground/80">Also: </span>
                            {phase.carryOver.join(" · ")}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
