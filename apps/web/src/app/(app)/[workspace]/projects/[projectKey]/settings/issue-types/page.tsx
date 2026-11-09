import { can } from "@tracklane/core";
import type { Metadata } from "next";
import { Suspense } from "react";
import { HeadingSkeleton, TableSkeleton } from "@/components/shared/skeletons";
import { IssueTypesManager } from "@/features/issue-types";
import { listIssueTypes } from "@/features/issue-types/server";
import { getProjectAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Issue types" };

type Props = PageProps<"/[workspace]/projects/[projectKey]/settings/issue-types">;

async function IssueTypes({ params }: { params: Props["params"] }) {
  const { workspace: slug, projectKey } = await params;
  const { project, role } = await getProjectAccess(slug, projectKey);
  const types = await listIssueTypes(project.id);
  return (
    <IssueTypesManager
      slug={slug}
      projectKey={project.key}
      types={types}
      canEdit={can(role, "projects:update")}
    />
  );
}

export default function IssueTypesSettingsPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl space-y-3">
          <HeadingSkeleton />
          <TableSkeleton />
        </div>
      }
    >
      <IssueTypes params={params} />
    </Suspense>
  );
}
