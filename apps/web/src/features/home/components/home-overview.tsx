import {
  CircleCheckIcon,
  CircleDashedIcon,
  ClockIcon,
  EyeIcon,
  InboxIcon,
  UserIcon,
} from "lucide-react";
import { type ReactNode, Suspense } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { CURRENT_PHASE, roadmap } from "../data/roadmap";
import { SystemStatus } from "./system-status";

const stats = [
  { label: "Assigned to me", icon: UserIcon },
  { label: "Due this week", icon: ClockIcon },
  { label: "Waiting on review", icon: EyeIcon },
  { label: "Done this sprint", icon: CircleCheckIcon },
] as const;

/** The workspace home. `header` streams in separately because it reads the session. */
export function HomeOverview({ header }: { header: ReactNode }) {
  const done = roadmap.filter((p) => p.phase <= CURRENT_PHASE).length;
  const percent = Math.round((done / roadmap.length) * 100);

  return (
    <div className="space-y-6">
      {header}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="gap-3 py-5">
            <CardHeader className="flex flex-row items-center justify-between px-5">
              <CardDescription className="font-medium">{stat.label}</CardDescription>
              <stat.icon className="size-4 text-muted-foreground" aria-hidden="true" />
            </CardHeader>
            <CardContent className="px-5">
              <p className="text-3xl font-semibold tracking-tight">0</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Assigned to me</CardTitle>
            <CardDescription>Issues you own across all projects.</CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={InboxIcon}
              title="Nothing assigned yet"
              description="Once projects and issues exist (Phase 2), your work shows up here."
            />
          </CardContent>
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
                Phase {CURRENT_PHASE} of {roadmap.length - 1} complete
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
