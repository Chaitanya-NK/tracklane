import { can } from "@tracklane/core";
import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { TableSkeleton } from "@/components/shared/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CreateIssueButton,
  hasActiveFilters,
  IssueListToolbar,
  parseIssueFilters,
} from "@/features/issues";
import {
  DEFAULT_LIST_COLUMNS,
  filtersToTql,
  LIST_COLUMNS,
  type ListColumn,
  parseGroupBy,
  ProjectIssueList,
  type ViewSummary,
  ViewTabs,
} from "@/features/project-views";
import {
  listGroupableFields,
  listRows,
  listViews,
  normalizeParams,
} from "@/features/project-views/server";
import { listAssignableUsers, listStatuses } from "@/features/projects/server";
import { getProjectAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Issues" };

type Props = PageProps<"/[workspace]/projects/[projectKey]">;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function parseColumns(value: string | undefined, fallback: string[]): ListColumn[] {
  const ids = new Set<string>(LIST_COLUMNS.map((c) => c.id));
  const list = value === undefined ? fallback : value.split(",");
  return list.filter((c): c is ListColumn => ids.has(c));
}

async function IssueList({ params, searchParams }: Props) {
  const [{ workspace: slug, projectKey }, sp] = await Promise.all([params, searchParams]);
  const { workspace, user, project, role } = await getProjectAccess(slug, projectKey);
  const [views, fields, statuses, people] = await Promise.all([
    listViews(project.id, user.id),
    listGroupableFields(project.id),
    listStatuses(project.id),
    listAssignableUsers(workspace.id),
  ]);
  const summaries: ViewSummary[] = views.map((v) => ({
    id: v.id,
    name: v.name,
    params: v.params,
    groupBy: v.groupBy,
    columns: v.columns,
    shared: v.shared,
    editable: v.editable,
    isDefault: v.isDefault,
    mine: v.mine,
    ownerName: v.owner.name,
  }));

  const raw = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    const v = first(value);
    if (v !== undefined) raw.set(key, v);
  }
  const viewId = first(sp.view);
  // First visit with no parameters opens the team default view.
  const fallback = summaries.find((v) => v.isDefault);
  if (!viewId && [...raw.keys()].length === 0 && fallback) {
    const next = new URLSearchParams(fallback.params);
    next.set("view", fallback.id);
    if (fallback.groupBy !== "none") next.set("group", fallback.groupBy);
    next.set("cols", fallback.columns.join(","));
    redirect(`/${slug}/projects/${project.key}?${next}` as Route);
  }
  const activeView = viewId ? (summaries.find((v) => v.id === viewId) ?? null) : null;

  const filters = parseIssueFilters(sp);
  const groupBy = parseGroupBy(first(sp.group), fields);
  const columns = parseColumns(
    first(sp.cols),
    activeView?.columns.length ? activeView.columns : DEFAULT_LIST_COLUMNS,
  );
  const { rows, truncated } = await listRows(project.id, user.id, filters, fields);

  return (
    <div className="space-y-4">
      <ViewTabs
        slug={slug}
        projectKey={project.key}
        views={summaries}
        activeId={activeView?.id ?? null}
        state={{ params: normalizeParams(raw.toString()), groupBy, columns }}
        canSetDefault={can(role, "projects:update")}
        isAdmin={can(role, "projects:update")}
      />
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <IssueListToolbar statuses={statuses} assignees={people} />
        </div>
        {can(role, "issues:create") ? (
          <CreateIssueButton size="sm" projectKey={project.key} />
        ) : null}
      </div>
      <ProjectIssueList
        slug={slug}
        projectKey={project.key}
        userId={user.id}
        rows={rows}
        truncated={truncated}
        hasFilters={hasActiveFilters(filters)}
        statusOrder={statuses.map((s) => s.id)}
        statusNames={statuses.map((s) => s.name)}
        people={people}
        fields={fields}
        activeView={activeView}
        params={normalizeParams(raw.toString())}
        groupBy={groupBy}
        columns={columns}
        tql={filtersToTql(project.key, filters, { statuses, people })}
        canEdit={can(role, "issues:update")}
        canDelete={can(role, "issues:delete")}
        canSetDefault={can(role, "projects:update")}
      />
    </div>
  );
}

export default function ProjectIssuesPage({ params, searchParams }: Props) {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-9 w-full max-w-md" />
          <Skeleton className="h-8 w-full max-w-xl" />
          <TableSkeleton rows={6} />
        </div>
      }
    >
      <IssueList params={params} searchParams={searchParams} />
    </Suspense>
  );
}
