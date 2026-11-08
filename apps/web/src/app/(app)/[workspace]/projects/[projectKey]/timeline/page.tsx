import { can } from "@tracklane/core";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Timeline } from "@/features/timeline";
import { getTimeline } from "@/features/timeline/server";
import { getProjectAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Timeline" };

type Props = PageProps<"/[workspace]/projects/[projectKey]/timeline">;

async function ProjectTimeline({ params }: { params: Props["params"] }) {
  const { workspace: slug, projectKey } = await params;
  const { project, role } = await getProjectAccess(slug, projectKey);
  const data = await getTimeline(project);
  return (
    <Timeline
      slug={slug}
      epics={data.epics}
      loose={data.loose}
      sprints={data.sprints}
      today={new Date().toISOString().slice(0, 10)}
      canEdit={can(role, "issues:update")}
    />
  );
}

export default function TimelinePage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
      <ProjectTimeline params={params} />
    </Suspense>
  );
}
