import { can } from "@tracklane/core";
import type { Metadata } from "next";
import { Suspense } from "react";
import { HeadingSkeleton, TableSkeleton } from "@/components/shared/skeletons";
import { listAssignableUsers } from "@/features/projects/server";
import { RecurringManager } from "@/features/recurring";
import { listRecurring } from "@/features/recurring/server";
import { getProjectAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Recurring issues" };

type Props = PageProps<"/[workspace]/projects/[projectKey]/settings/recurring">;

async function Recurring({ params }: { params: Props["params"] }) {
  const { workspace: slug, projectKey } = await params;
  const { workspace, project, role } = await getProjectAccess(slug, projectKey);
  const [rows, people] = await Promise.all([
    listRecurring(project.id),
    listAssignableUsers(workspace.id),
  ]);
  return (
    <RecurringManager
      slug={slug}
      projectKey={project.key}
      rows={rows}
      people={people.map((p) => ({ id: p.id, name: p.name }))}
      canEdit={can(role, "projects:update")}
    />
  );
}

export default function RecurringSettingsPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl space-y-3">
          <HeadingSkeleton />
          <TableSkeleton />
        </div>
      }
    >
      <Recurring params={params} />
    </Suspense>
  );
}
