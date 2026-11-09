import { can } from "@tracklane/core";
import { KanbanSquareIcon } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Board } from "@/features/board";
import { toPlanningCard } from "@/features/board/server";
import { listStatuses } from "@/features/projects/server";
import { ActiveSprintHeader } from "@/features/sprints";
import { getActiveSprint, getBoardIssues, listOpenSprints } from "@/features/sprints/server";
import { getTransitionRules } from "@/features/workflow/server";
import { getProjectAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Board" };

type Props = PageProps<"/[workspace]/projects/[projectKey]/board">;

const toDateString = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : null);

function BoardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-8 w-96 max-w-full" />
      <div className="flex gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-96 w-72 shrink-0 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

async function ProjectBoard({ params }: { params: Props["params"] }) {
  const { workspace: slug, projectKey } = await params;
  const { user, project, role } = await getProjectAccess(slug, projectKey);
  const sprint = project.type === "scrum" ? await getActiveSprint(project.id) : null;

  if (project.type === "scrum" && !sprint) {
    return (
      <EmptyState
        icon={KanbanSquareIcon}
        title="No active sprint"
        description="Plan a sprint in the backlog and start it to see its issues here."
        action={
          <Button asChild>
            <Link href={`/${slug}/projects/${project.key}/backlog` as Route}>Go to backlog</Link>
          </Button>
        }
      />
    );
  }

  const [statuses, issues, openSprints, transitions] = await Promise.all([
    listStatuses(project.id),
    getBoardIssues(project, sprint?.id ?? null),
    sprint ? listOpenSprints(project.id) : Promise.resolve([]),
    getTransitionRules(project.id),
  ]);
  const cards = issues.map(toPlanningCard);
  const done = cards.filter((c) => c.status.category === "done").length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {sprint ? (
        <ActiveSprintHeader
          sprint={{
            id: sprint.id,
            name: sprint.name,
            goal: sprint.goal,
            startDate: toDateString(sprint.startDate),
            endDate: toDateString(sprint.endDate),
          }}
          doneCount={done}
          openCount={cards.length - done}
          plannedSprints={openSprints.filter((s) => s.state === "planned")}
          canManage={can(role, "sprints:manage")}
        />
      ) : null}
      <Board
        slug={slug}
        columns={statuses
          .filter((s) => project.type !== "kanban" || s.id !== project.backlogStatusId)
          .map(({ id, name, category, wipLimit }) => ({ id, name, category, wipLimit }))}
        transitions={transitions}
        cards={cards}
        canEdit={can(role, "issues:update")}
        currentUserId={user.id}
        columnContext={{
          slug,
          projectKey: project.key,
          sprintId: sprint?.id ?? null,
          canManage: can(role, "projects:update"),
          canCreate: can(role, "issues:create"),
        }}
      />
    </div>
  );
}

export default function BoardPage({ params }: Props) {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <ProjectBoard params={params} />
    </Suspense>
  );
}
