import { can } from "@tracklane/core";
import type { Metadata } from "next";
import { Suspense } from "react";
import { TableSkeleton } from "@/components/shared/skeletons";
import { NextRelease, ReleasesManager } from "@/features/releases";
import { checklistCounts, listReleases } from "@/features/releases/server";
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
  const today = todayIso();
  const next = releases
    .filter((r) => r.status === "unreleased")
    .sort((a, b) => (a.releaseDate ?? "9999").localeCompare(b.releaseDate ?? "9999"))[0];
  const checklist = next ? await checklistCounts([next.id]) : new Map();
  return (
    <div className="space-y-6">
      {next ? (
        <NextRelease
          href={`/${slug}/projects/${project.key}/releases/${next.id}`}
          release={{
            name: next.name,
            releaseDate: next.releaseDate,
            counts: next.counts,
            checklist: checklist.get(next.id) ?? { done: 0, total: 0 },
          }}
          today={today}
        />
      ) : null}
      <ReleasesManager
        slug={slug}
        projectKey={project.key}
        releases={releases}
        showArchived={showArchived}
        canEdit={can(role, "projects:update")}
        today={today}
      />
    </div>
  );
}

export default function ReleasesPage(props: Props) {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <Releases {...props} />
    </Suspense>
  );
}
