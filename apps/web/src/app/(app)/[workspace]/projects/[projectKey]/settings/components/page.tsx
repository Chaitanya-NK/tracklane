import { can } from "@tracklane/core";
import type { Metadata } from "next";
import { Suspense } from "react";
import { HeadingSkeleton, TableSkeleton } from "@/components/shared/skeletons";
import { ComponentsManager } from "@/features/components";
import { listComponents } from "@/features/components/server";
import { listAssignableUsers } from "@/features/projects/server";
import { getProjectAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Components" };

type Props = PageProps<"/[workspace]/projects/[projectKey]/settings/components">;

async function Components({ params }: { params: Props["params"] }) {
  const { workspace: slug, projectKey } = await params;
  const { workspace, project, role } = await getProjectAccess(slug, projectKey);
  const [components, people] = await Promise.all([
    listComponents(project.id),
    listAssignableUsers(workspace.id),
  ]);
  return (
    <ComponentsManager
      slug={slug}
      projectKey={project.key}
      components={components}
      people={people}
      canEdit={can(role, "projects:update")}
    />
  );
}

export default function ComponentsSettingsPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl space-y-3">
          <HeadingSkeleton />
          <TableSkeleton />
        </div>
      }
    >
      <Components params={params} />
    </Suspense>
  );
}
