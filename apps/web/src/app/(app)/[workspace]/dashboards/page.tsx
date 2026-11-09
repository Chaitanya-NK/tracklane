import { LayoutDashboardIcon } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/shared/skeletons";
import { TimeAgo } from "@/components/shared/time-ago";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NewDashboardButton, SharedBadge } from "@/features/dashboards";
import { listDashboards } from "@/features/dashboards/server";
import { getWorkspaceAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Dashboards" };

type Props = PageProps<"/[workspace]/dashboards">;

async function DashboardList({ params }: { params: Props["params"] }) {
  const { workspace: slug } = await params;
  const { workspace, user } = await getWorkspaceAccess(slug);
  const dashboards = await listDashboards(workspace.id, user.id);
  if (!dashboards.length) {
    return (
      <EmptyState
        icon={LayoutDashboardIcon}
        title="No dashboards yet"
        description="Create one from the My work template, or start blank and add counts, charts and lists."
        action={<NewDashboardButton slug={workspace.slug} />}
      />
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <NewDashboardButton slug={workspace.slug} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {dashboards.map((d) => (
          <Link
            key={d.id}
            href={`/${slug}/dashboards/${d.id}` as Route}
            className="group rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Card className="h-full transition-colors group-hover:border-primary/40">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span className="truncate">{d.name}</span>
                  <SharedBadge shared={d.shared} />
                </CardTitle>
                <CardDescription className="line-clamp-2">
                  {d.description || `${d.widgetCount} widgets`}
                </CardDescription>
                <p className="text-xs text-muted-foreground">
                  {d.ownerId === user.id ? "You" : (d.owner?.name ?? "Former member")} · updated{" "}
                  <TimeAgo date={d.updatedAt} />
                </p>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function DashboardsPage({ params }: Props) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboards"
        description="Your own and shared views of the work: counts, breakdowns, trends and sprint reports."
      />
      <Suspense fallback={<TableSkeleton />}>
        <DashboardList params={params} />
      </Suspense>
    </div>
  );
}
