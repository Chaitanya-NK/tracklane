import { can } from "@tracklane/core";
import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { toPlanningCard } from "@/features/board/server";
import { Backlog } from "@/features/sprints";
import { getBacklog } from "@/features/sprints/server";
import { getProjectAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Backlog" };

type Props = PageProps<"/[workspace]/projects/[projectKey]/backlog">;

const toDateString = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : null);

function BacklogSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-8 w-96 max-w-full" />
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-40 w-full rounded-lg" />
      ))}
    </div>
  );
}

async function ProjectBacklog({ params }: { params: Props["params"] }) {
  const { workspace: slug, projectKey } = await params;
  const { user, project, role } = await getProjectAccess(slug, projectKey);
  // Kanban projects have no sprints; their backlog is the To Do column.
  if (project.type !== "scrum") redirect(`/${slug}/projects/${project.key}/board` as Route);
  const { sprints, backlog } = await getBacklog(project.id);

  return (
    <Backlog
      slug={slug}
      projectKey={project.key}
      currentUserId={user.id}
      canEdit={can(role, "issues:update")}
      canManageSprints={can(role, "sprints:manage")}
      backlog={backlog.map(toPlanningCard)}
      sprints={sprints.map((sprint) => ({
        id: sprint.id,
        name: sprint.name,
        goal: sprint.goal,
        state: sprint.state,
        startDate: toDateString(sprint.startDate),
        endDate: toDateString(sprint.endDate),
        cards: sprint.issues.map(toPlanningCard),
      }))}
    />
  );
}

export default function BacklogPage({ params }: Props) {
  return (
    <Suspense fallback={<BacklogSkeleton />}>
      <ProjectBacklog params={params} />
    </Suspense>
  );
}
