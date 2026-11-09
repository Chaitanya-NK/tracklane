import type { Metadata } from "next";
import { Suspense } from "react";
import { TableSkeleton } from "@/components/shared/skeletons";
import { WorkloadHeatmap, type WorkloadMetric, workingDaysFrom } from "@/features/reports";
import { getWorkloadPlan } from "@/features/reports/server";
import { weekStart } from "@/features/time/server";
import { getWorkspaceAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Workload" };

type Props = PageProps<"/[workspace]/teams">;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const DAY = 86_400_000;

async function Workload({ params, searchParams }: Props) {
  const [{ workspace: slug }, sp] = await Promise.all([params, searchParams]);
  const { workspace } = await getWorkspaceAccess(slug);
  const metricParam = first(sp.metric);
  const metric: WorkloadMetric =
    metricParam === "points" || metricParam === "issues" ? metricParam : "hours";
  const weeks = [1, 2, 4].includes(Number(first(sp.weeks))) ? Number(first(sp.weeks)) : 2;
  const fromParam = first(sp.from);
  const from = iso(
    weekStart(
      fromParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam)
        ? new Date(`${fromParam}T00:00:00Z`)
        : new Date(),
    ),
  );
  const days = workingDaysFrom(from, weeks * 5);
  const plan = await getWorkloadPlan({ workspaceId: workspace.id, from, days, metric });
  const href = (patch: { metric?: WorkloadMetric; weeks?: number; shift?: number }) => {
    const next = new URLSearchParams({
      metric: patch.metric ?? metric,
      weeks: String(patch.weeks ?? weeks),
    });
    if (patch.shift !== 0) {
      const base = new Date(`${from}T00:00:00Z`).getTime();
      const moved = patch.shift ? base + patch.shift * weeks * 7 * DAY : base;
      next.set("from", iso(new Date(moved)));
    }
    return `/${slug}/teams?${next}`;
  };
  return <WorkloadHeatmap slug={slug} plan={plan} days={days} metric={metric} href={href} />;
}

export default function WorkloadPage(props: Props) {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <Workload {...props} />
    </Suspense>
  );
}
