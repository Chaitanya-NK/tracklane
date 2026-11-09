import { can } from "@tracklane/core";
import type { Metadata } from "next";
import { Suspense } from "react";
import { HeadingSkeleton, TableSkeleton } from "@/components/shared/skeletons";
import { getTqlCatalog } from "@/features/search/server";
import { SlaPoliciesManager } from "@/features/sla";
import { listSlaPolicies } from "@/features/sla/server";
import { getProjectAccess } from "@/server/authz";

export const metadata: Metadata = { title: "SLAs" };

type Props = PageProps<"/[workspace]/projects/[projectKey]/settings/slas">;

async function Slas({ params }: { params: Props["params"] }) {
  const { workspace: slug, projectKey } = await params;
  const { workspace, project, role, user } = await getProjectAccess(slug, projectKey);
  const [policies, catalog] = await Promise.all([
    listSlaPolicies(project.id),
    getTqlCatalog(workspace.id, user.id),
  ]);
  return (
    <SlaPoliciesManager
      slug={slug}
      projectKey={project.key}
      policies={policies}
      catalog={catalog}
      canEdit={can(role, "projects:update")}
    />
  );
}

export default function SlaSettingsPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl space-y-3">
          <HeadingSkeleton />
          <TableSkeleton />
        </div>
      }
    >
      <Slas params={params} />
    </Suspense>
  );
}
