import { can } from "@tracklane/core";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { HeadingSkeleton, TableSkeleton } from "@/components/shared/skeletons";
import { Button } from "@/components/ui/button";
import { IssueTable } from "@/features/issues";
import { ReleaseDetail } from "@/features/releases";
import { getRelease, listReleases } from "@/features/releases/server";
import { getProjectAccess } from "@/server/authz";
import { ArrowLeftIcon } from "lucide-react";

export const metadata: Metadata = { title: "Release" };

type Props = PageProps<"/[workspace]/projects/[projectKey]/releases/[releaseId]">;

async function Release({ params }: { params: Props["params"] }) {
  const { workspace: slug, projectKey, releaseId } = await params;
  const { project, role } = await getProjectAccess(slug, projectKey);
  const [found, all] = await Promise.all([
    getRelease(project.id, releaseId),
    listReleases(project.id, false),
  ]);
  if (!found) notFound();
  const counts = all.find((r) => r.id === releaseId)?.counts ?? {
    todo: found.issues.filter((i) => i.status.category === "todo").length,
    in_progress: found.issues.filter((i) => i.status.category === "in_progress").length,
    done: found.issues.filter((i) => i.status.category === "done").length,
  };
  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href={`/${slug}/projects/${project.key}/releases` as Route}>
          <ArrowLeftIcon />
          All releases
        </Link>
      </Button>
      <ReleaseDetail
        slug={slug}
        projectKey={project.key}
        release={found.release}
        counts={counts}
        others={all.filter((r) => r.status === "unreleased" && r.id !== releaseId)}
        notes={found.notes}
        canEdit={can(role, "projects:update")}
      />
      <section className="space-y-3" aria-labelledby="release-issues">
        <h2 id="release-issues" className="text-sm font-semibold">
          Issues <span className="font-normal text-muted-foreground">({found.issues.length})</span>
        </h2>
        {found.issues.length ? (
          <IssueTable slug={slug} issues={found.issues} />
        ) : (
          <p className="text-sm text-muted-foreground">
            None yet. Set the fix version in an issue&apos;s details, or search with{" "}
            <code className="font-mono text-xs">release = &quot;{found.release.name}&quot;</code>.
          </p>
        )}
      </section>
    </div>
  );
}

export default function ReleasePage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <HeadingSkeleton />
          <TableSkeleton />
        </div>
      }
    >
      <Release params={params} />
    </Suspense>
  );
}
