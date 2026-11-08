import { can } from "@tracklane/core";
import { InboxIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CreateIssueButton,
  hasActiveFilters,
  IssueListToolbar,
  IssueTable,
  parseIssueFilters,
} from "@/features/issues";
import { listProjectIssues } from "@/features/issues/server";
import { listAssignableUsers, listStatuses } from "@/features/projects/server";
import { getProjectAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Issues" };

type Props = PageProps<"/[workspace]/projects/[projectKey]">;

async function Toolbar({ params }: { params: Props["params"] }) {
  const { workspace: slug, projectKey } = await params;
  const { workspace, project, role } = await getProjectAccess(slug, projectKey);
  const [statuses, assignees] = await Promise.all([
    listStatuses(project.id),
    listAssignableUsers(workspace.id),
  ]);
  return (
    <div className="flex flex-wrap items-start gap-2">
      <div className="min-w-0 flex-1">
        <IssueListToolbar statuses={statuses} assignees={assignees} />
      </div>
      {can(role, "issues:create") ? <CreateIssueButton size="sm" projectKey={project.key} /> : null}
    </div>
  );
}

async function Issues({ params, searchParams }: Props) {
  const [{ workspace: slug, projectKey }, query] = await Promise.all([params, searchParams]);
  const { user, project } = await getProjectAccess(slug, projectKey);
  const filters = parseIssueFilters(query);
  const { issues, truncated } = await listProjectIssues(project.id, user.id, filters);

  if (issues.length === 0) {
    return hasActiveFilters(filters) ? (
      <EmptyState
        icon={InboxIcon}
        title="No matching issues"
        description="Try removing some filters."
      />
    ) : (
      <EmptyState
        icon={InboxIcon}
        title="No issues yet"
        description="Create the first issue — or press C anywhere."
      />
    );
  }
  return (
    <div className="space-y-2">
      <IssueTable slug={slug} issues={issues} />
      <p className="text-xs text-muted-foreground">
        {truncated
          ? `Showing the first ${issues.length} issues. Narrow the filters to see more.`
          : `${issues.length} issue${issues.length === 1 ? "" : "s"}`}
      </p>
    </div>
  );
}

export default function ProjectIssuesPage({ params, searchParams }: Props) {
  return (
    <div className="space-y-4">
      <Suspense fallback={<Skeleton className="h-8 w-full max-w-xl" />}>
        <Toolbar params={params} />
      </Suspense>
      <Suspense fallback={<TableSkeleton rows={6} />}>
        <Issues params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
