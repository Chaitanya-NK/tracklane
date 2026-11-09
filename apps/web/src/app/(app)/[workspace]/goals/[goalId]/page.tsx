import { can, formatIssueKey } from "@tracklane/core";
import { ArrowLeftIcon } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Markdown } from "@/components/shared/markdown";
import { HeadingSkeleton, TableSkeleton } from "@/components/shared/skeletons";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { GoalActions, GoalIssues, GoalProgress, GoalStatusBadge } from "@/features/goals";
import { getGoal } from "@/features/goals/server";
import { listAssignableUsers } from "@/features/projects/server";
import { formatDate } from "@/lib/format";
import { getWorkspaceAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Goal" };

type Props = PageProps<"/[workspace]/goals/[goalId]">;

async function Goal({ params }: { params: Props["params"] }) {
  const { workspace: slug, goalId } = await params;
  const { workspace, user, role } = await getWorkspaceAccess(slug);
  const [goal, people] = await Promise.all([
    getGoal(workspace.id, goalId),
    listAssignableUsers(workspace.id),
  ]);
  if (!goal) notFound();
  const canEdit = can(role, "issues:update");
  return (
    <div className="max-w-4xl space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href={`/${slug}/goals` as Route}>
          <ArrowLeftIcon />
          All goals
        </Link>
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{goal.name}</h1>
            <GoalStatusBadge status={goal.status} />
          </div>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            {goal.owner ? (
              <>
                <UserAvatar user={goal.owner} className="size-5" />
                {goal.owner.name}
              </>
            ) : (
              "No owner"
            )}
            {goal.targetDate ? <span>· target {formatDate(goal.targetDate)}</span> : null}
          </p>
        </div>
        <GoalActions
          slug={slug}
          goal={{
            id: goal.id,
            name: goal.name,
            description: goal.description,
            status: goal.status,
            ownerId: goal.ownerId,
            targetDate: goal.targetDate,
          }}
          people={people.map((p) => ({ id: p.id, name: p.name }))}
          currentUserId={user.id}
          canEdit={canEdit}
          canDelete={goal.ownerId === user.id || can(role, "projects:update")}
        />
      </div>
      <div className="max-w-md">
        <GoalProgress progress={goal.progress} />
      </div>
      {goal.description ? <Markdown>{goal.description}</Markdown> : null}
      <GoalIssues
        slug={slug}
        goalId={goal.id}
        canEdit={canEdit}
        issues={goal.issues.map((i) => ({
          id: i.id,
          key: formatIssueKey(i.project.key, i.number),
          title: i.title,
          type: i.type,
          customType: i.customType,
          status: i.status,
          children: i._count.children,
        }))}
      />
    </div>
  );
}

export default function GoalPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl space-y-3">
          <HeadingSkeleton />
          <TableSkeleton />
        </div>
      }
    >
      <Goal params={params} />
    </Suspense>
  );
}
