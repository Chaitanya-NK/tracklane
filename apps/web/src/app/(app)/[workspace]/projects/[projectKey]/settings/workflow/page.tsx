import { can } from "@tracklane/core";
import type { Metadata } from "next";
import { Suspense } from "react";
import { HeadingSkeleton, TableSkeleton } from "@/components/shared/skeletons";
import { WorkflowEditor } from "@/features/workflow";
import { getWorkflow } from "@/features/workflow/server";
import { getProjectAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Workflow" };

type Props = PageProps<"/[workspace]/projects/[projectKey]/settings/workflow">;

async function Workflow({ params }: { params: Props["params"] }) {
  const { workspace: slug, projectKey } = await params;
  const { project, role } = await getProjectAccess(slug, projectKey);
  const workflow = await getWorkflow(project.id);
  return (
    <div className="max-w-4xl">
      <WorkflowEditor
        slug={slug}
        projectKey={project.key}
        projectType={workflow.type}
        statuses={workflow.statuses}
        restrict={workflow.restrict}
        transitions={workflow.transitions}
        backlogStatusId={workflow.backlogStatusId}
        canEdit={can(role, "projects:update")}
      />
    </div>
  );
}

export default function WorkflowSettingsPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl space-y-3">
          <HeadingSkeleton />
          <TableSkeleton />
        </div>
      }
    >
      <Workflow params={params} />
    </Suspense>
  );
}
