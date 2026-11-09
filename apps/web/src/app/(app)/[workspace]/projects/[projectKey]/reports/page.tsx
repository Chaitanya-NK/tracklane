import { averageVelocity } from "@tracklane/core";
import type { Metadata } from "next";
import { Suspense } from "react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { DownloadIcon } from "lucide-react";
import {
  BreakdownChart,
  BurndownChart,
  CreatedResolvedChart,
  CycleTimeChart,
  FlowChart,
  forecastFinish,
  SprintReportView,
  SlaReport,
  SprintPicker,
  VelocityChart,
  WorkloadTable,
} from "@/features/reports";
import {
  getBreakdown,
  getBurndown,
  getCreatedResolved,
  getCycleTime,
  getFlow,
  getSprintReport,
  getVelocity,
  getWorkload,
} from "@/features/reports/server";
import { slaReport } from "@/features/sla/server";
import { weekStart } from "@/features/time/server";
import { getProjectAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Reports" };

type Props = PageProps<"/[workspace]/projects/[projectKey]/reports">;

/** Outside the component: reading the clock is request-time work, not render logic. */
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

function ChartSkeleton() {
  return <Skeleton className="h-64 w-full" />;
}

function ReportCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

async function Reports({ params, searchParams }: Props) {
  const [{ workspace: slug, projectKey }, sp] = await Promise.all([params, searchParams]);
  const { workspace, project } = await getProjectAccess(slug, projectKey);
  const sprintParam = typeof sp.sprint === "string" ? sp.sprint : undefined;
  const scrum = project.type === "scrum";
  const since = daysAgo(30);
  const [burn, velocity, flow, createdResolved, byPriority, slas, workload, cycle] =
    await Promise.all([
      scrum ? getBurndown(project.id, sprintParam) : Promise.resolve(null),
      scrum ? getVelocity(project.id) : Promise.resolve([]),
      getFlow(project.id, 30),
      getCreatedResolved({ projectId: project.id }, 30),
      getBreakdown({ projectId: project.id, status: { category: { not: "done" } } }, "priority"),
      slaReport(project.id, workspace.id, since),
      getWorkload(workspace.id, project.id, weekStart(new Date())),
      getCycleTime(project.id, 90),
    ]);
  const sprintReport = burn?.sprint ? await getSprintReport(project.id, burn.sprint.id) : null;
  const unit = sp.unit === "issues" ? "issues" : "points";
  const scopes = (burn?.points ?? []).map((p) => p.scope).filter((v): v is number => v !== null);
  const remaining = (burn?.points ?? [])
    .map((p) => p.remaining)
    .filter((v): v is number => v !== null);
  const today = new Date().toISOString().slice(0, 10);
  const exportHref = (report: string, extra = "") =>
    `/api/reports/export?workspace=${slug}&project=${project.key}&report=${report}${extra}`;
  const average = averageVelocity(velocity);

  return (
    <div className="@container grid gap-4 lg:grid-cols-2">
      {burn ? (
        <ReportCard
          title="Burndown"
          description={
            burn.sprint
              ? `Story points left in ${burn.sprint.name} (${burn.sprint.start} → ${burn.sprint.end}). Steps up when scope is added.`
              : "Start a sprint to see its burndown."
          }
          action={
            burn.sprint && burn.sprints.length > 1 ? (
              <SprintPicker value={burn.sprint.id} sprints={burn.sprints} />
            ) : null
          }
        >
          {burn.points.length ? (
            <BurndownChart points={burn.points} />
          ) : (
            <p className="text-sm text-muted-foreground">No sprint data yet.</p>
          )}
        </ReportCard>
      ) : null}
      {sprintReport && burn?.sprint ? (
        <ReportCard
          title={`Sprint report · ${sprintReport.name}`}
          description="What was committed, what got done, and what's left."
          className="lg:col-span-2"
          action={
            <Button asChild variant="outline" size="sm">
              <a href={exportHref("sprint", `&sprint=${burn.sprint.id}`)} download>
                <DownloadIcon aria-hidden="true" /> Export
              </a>
            </Button>
          }
        >
          <SprintReportView
            slug={slug}
            unit={unit}
            unitHref={(u) =>
              `/${slug}/projects/${project.key}/reports?${new URLSearchParams({
                ...(sprintParam ? { sprint: sprintParam } : {}),
                unit: u,
              })}`
            }
            report={{
              ...sprintReport,
              scopeAdded: scopes.length ? Math.max(...scopes) - scopes[0]! : 0,
              end: burn.sprint.end,
              forecast:
                sprintReport.state === "active" && scopes.length && remaining.length
                  ? forecastFinish({
                      start: burn.sprint.start,
                      today,
                      initialScope: scopes[0]!,
                      remaining: remaining.at(-1)!,
                    })
                  : null,
            }}
          />
        </ReportCard>
      ) : null}
      {scrum ? (
        <ReportCard
          title="Velocity"
          description={
            velocity.length
              ? `Points committed vs completed per sprint. Average of the last 3: ${average} points.`
              : "Complete a sprint to start measuring velocity."
          }
        >
          {velocity.length ? (
            <VelocityChart points={velocity} />
          ) : (
            <p className="text-sm text-muted-foreground">No completed sprints yet.</p>
          )}
        </ReportCard>
      ) : null}
      <ReportCard
        title="Cumulative flow"
        description="Issues in each status category per day, last 30 days. Widening bands show where work piles up."
      >
        <FlowChart points={flow} />
      </ReportCard>
      <ReportCard
        title="Created vs resolved"
        description="New and resolved issues per day, last 30 days."
      >
        <CreatedResolvedChart points={createdResolved} />
      </ReportCard>
      <ReportCard
        title="Cycle time"
        description={
          cycle.stats.count
            ? `From starting work to resolution, last 90 days (${cycle.stats.count} issues). Median ${cycle.stats.median} days · 85% within ${cycle.stats.p85} days.`
            : "Resolve some issues to measure cycle time."
        }
        action={
          cycle.stats.count ? (
            <Button asChild variant="outline" size="sm">
              <a href={exportHref("cycle")} download>
                <DownloadIcon aria-hidden="true" /> Export
              </a>
            </Button>
          ) : null
        }
      >
        <CycleTimeChart buckets={cycle.stats.buckets} />
      </ReportCard>
      <ReportCard title="Open work by priority" description="Issues not done yet.">
        <BreakdownChart rows={byPriority} label="Priority" />
      </ReportCard>
      <ReportCard
        title="SLAs"
        description="Issues created in the last 30 days, per SLA."
        className="lg:col-span-2"
      >
        {slas.length ? (
          <SlaReport slug={slug} rows={slas} />
        ) : (
          <p className="text-sm text-muted-foreground">
            No SLAs yet — add them under Settings → SLAs.
          </p>
        )}
      </ReportCard>
      <ReportCard
        title="Workload"
        description="Open issues and points per person in this project, and time logged this week."
        className="lg:col-span-2"
      >
        <WorkloadTable rows={workload} />
      </ReportCard>
    </div>
  );
}

export default function ReportsPage(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      }
    >
      <Reports {...props} />
    </Suspense>
  );
}
