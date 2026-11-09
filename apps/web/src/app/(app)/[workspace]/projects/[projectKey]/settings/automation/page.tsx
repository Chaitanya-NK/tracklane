import { can } from "@tracklane/core";
import type { Metadata } from "next";
import { Suspense } from "react";
import { HeadingSkeleton, TableSkeleton } from "@/components/shared/skeletons";
import { AutomationManager } from "@/features/automation";
import { listRules, listRuns } from "@/features/automation/server";
import { listAssignableUsers, listLabels, listStatuses } from "@/features/projects/server";
import { getTqlCatalog } from "@/features/search/server";
import { getProjectAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Automation" };

type Props = PageProps<"/[workspace]/projects/[projectKey]/settings/automation">;

async function Automation({ params }: { params: Props["params"] }) {
  const { workspace: slug, projectKey } = await params;
  const { workspace, project, role, user } = await getProjectAccess(slug, projectKey);
  const [rules, runs, statuses, labels, people, catalog] = await Promise.all([
    listRules(project.id),
    listRuns(project.id),
    listStatuses(project.id),
    listLabels(project.id),
    listAssignableUsers(workspace.id),
    getTqlCatalog(workspace.id, user.id),
  ]);
  return (
    <AutomationManager
      slug={slug}
      projectKey={project.key}
      rules={rules}
      runs={runs.map((r) => ({
        id: r.id,
        status: r.status,
        message: r.message,
        createdAt: r.createdAt,
        ruleName: r.rule.name,
        issueKey: r.issue ? `${r.issue.project.key}-${r.issue.number}` : null,
      }))}
      options={{
        statuses: statuses.map((s) => ({ id: s.id, name: s.name })),
        labels: labels.map((l) => ({ id: l.id, name: l.name })),
        people: people.map((p) => ({ id: p.id, name: p.name })),
        catalog,
      }}
      canEdit={can(role, "projects:update")}
    />
  );
}

export default function AutomationSettingsPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl space-y-3">
          <HeadingSkeleton />
          <TableSkeleton />
        </div>
      }
    >
      <Automation params={params} />
    </Suspense>
  );
}
