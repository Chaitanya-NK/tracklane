import { can } from "@tracklane/core";
import { InboxIcon } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toPlanningCard } from "@/features/board/server";
import { listStatuses } from "@/features/projects/server";
import { Backlog, KanbanBacklog } from "@/features/sprints";
import { getBacklog, getKanbanBacklog } from "@/features/sprints/server";
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
  if (project.type === "kanban") {
    const backlogStatusId = project.backlogStatusId;
    if (!backlogStatusId) {
      return (
        <EmptyState
          icon={InboxIcon}
          title="This board has no backlog"
          description="Pick a To do status as the backlog: its issues move here and off the board until someone pulls them in."
          action={
            can(role, "projects:update") ? (
              <Button asChild>
                <Link href={`/${slug}/projects/${project.key}/settings/workflow` as Route}>
                  Set up the backlog
                </Link>
              </Button>
            ) : undefined
          }
        />
      );
    }
    const [statuses, issues] = await Promise.all([
      listStatuses(project.id),
      getKanbanBacklog(project.id, backlogStatusId),
    ]);
    const backlogStatus = statuses.find((s) => s.id === backlogStatusId);
    // "To board" moves to the first column after the backlog (a To do one if there is one).
    const boardStatuses = statuses.filter((s) => s.id !== backlogStatusId);
    const boardStatus =
      boardStatuses.find((s) => s.category === "todo") ?? boardStatuses[0] ?? null;
    return (
      <KanbanBacklog
        slug={slug}
        projectKey={project.key}
        cards={issues.map(toPlanningCard)}
        backlogStatusName={backlogStatus?.name ?? "Backlog"}
        boardStatus={boardStatus ? { id: boardStatus.id, name: boardStatus.name } : null}
        canEdit={can(role, "issues:update")}
        currentUserId={user.id}
      />
    );
  }
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
