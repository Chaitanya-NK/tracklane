import { can } from "@tracklane/core";
import type { Metadata } from "next";
import { Suspense } from "react";
import { TableSkeleton } from "@/components/shared/skeletons";
import { ReleasesManager } from "@/features/releases";
import { listReleases } from "@/features/releases/server";
import { getProjectAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Releases" };

type Props = PageProps<"/[workspace]/projects/[projectKey]/releases">;

/** Outside the component: reading the clock is request-time work, not render logic. */
const todayIso = () => new Date().toISOString().slice(0, 10);

async function Releases({ params, searchParams }: Props) {
  const [{ workspace: slug, projectKey }, query] = await Promise.all([params, searchParams]);
  const { project, role } = await getProjectAccess(slug, projectKey);
  const showArchived = query.archived === "1";
  const releases = await listReleases(project.id, showArchived);
  return (
    <ReleasesManager
      slug={slug}
      projectKey={project.key}
      releases={releases}
      showArchived={showArchived}
      canEdit={can(role, "projects:update")}
      today={todayIso()}
    />
  );
}

export default function ReleasesPage(props: Props) {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <Releases {...props} />
    </Suspense>
  );
}
