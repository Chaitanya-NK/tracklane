import { LayoutDashboardIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { HeadingSkeleton } from "@/components/shared/skeletons";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DashboardToolbar,
  type EditorContext,
  SharedBadge,
  WidgetMenu,
} from "@/features/dashboards";
import { getDashboard, WidgetBody } from "@/features/dashboards/server";
import { getTqlCatalog } from "@/features/search/server";
import { db } from "@tracklane/db";
import { getWorkspaceAccess } from "@/server/authz";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

type Props = PageProps<"/[workspace]/dashboards/[dashboardId]">;

async function DashboardView({ params, searchParams }: Props) {
  const [{ workspace: slug, dashboardId }, sp] = await Promise.all([params, searchParams]);
  const { workspace, user } = await getWorkspaceAccess(slug);
  const dashboard = await getDashboard(workspace.id, user.id, dashboardId);
  if (!dashboard) notFound();
  const editing = dashboard.canEdit && sp.edit === "1";
  const [catalog, projects] = editing
    ? await Promise.all([
        getTqlCatalog(workspace.id, user.id),
        db.project.findMany({
          where: { workspaceId: workspace.id, archivedAt: null },
          orderBy: { name: "asc" },
          select: { key: true, name: true, type: true },
        }),
      ])
    : [null, []];
  const ctx: EditorContext | null = editing
    ? { slug, dashboardId: dashboard.id, widgets: dashboard.widgets, catalog: catalog!, projects }
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            {dashboard.name} <SharedBadge shared={dashboard.shared} />
          </h1>
          {dashboard.description ? (
            <p className="text-sm text-muted-foreground">{dashboard.description}</p>
          ) : null}
        </div>
        {dashboard.canEdit ? (
          <DashboardToolbar
            ctx={
              ctx ?? {
                slug,
                dashboardId: dashboard.id,
                widgets: dashboard.widgets,
                catalog: { projects: [], statuses: [], users: [], labels: [], sprints: [] },
                projects: [],
              }
            }
            editing={editing}
            meta={{
              name: dashboard.name,
              description: dashboard.description,
              shared: dashboard.shared,
            }}
          />
        ) : null}
      </div>
      {dashboard.widgets.length === 0 ? (
        <EmptyState
          icon={LayoutDashboardIcon}
          title="This dashboard is empty"
          description={
            dashboard.canEdit
              ? "Choose Edit, then Add widget."
              : "Its owner hasn't added widgets yet."
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {dashboard.widgets.map((widget, index) => (
            <Card key={widget.id} className={cn(widget.size === "full" && "lg:col-span-2")}>
              <CardHeader>
                <CardTitle className="text-base">{widget.title}</CardTitle>
                {ctx ? (
                  <CardAction>
                    <WidgetMenu ctx={ctx} index={index} />
                  </CardAction>
                ) : null}
              </CardHeader>
              <CardContent>
                <Suspense fallback={<Skeleton className="h-40 w-full" />}>
                  <WidgetBody
                    widget={widget}
                    slug={slug}
                    workspaceId={workspace.id}
                    userId={user.id}
                  />
                </Suspense>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <HeadingSkeleton />
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-56" />
            <Skeleton className="h-56" />
          </div>
        </div>
      }
    >
      <DashboardView {...props} />
    </Suspense>
  );
}
