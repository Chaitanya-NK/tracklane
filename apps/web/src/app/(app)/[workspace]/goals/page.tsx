import { can } from "@tracklane/core";
import { TargetIcon } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/shared/skeletons";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GoalProgress, GoalStatusBadge, NewGoalButton } from "@/features/goals";
import { listGoals } from "@/features/goals/server";
import { listAssignableUsers } from "@/features/projects/server";
import { formatDate } from "@/lib/format";
import { getWorkspaceAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Goals" };

type Props = PageProps<"/[workspace]/goals">;

async function GoalList({ params }: { params: Props["params"] }) {
  const { workspace: slug } = await params;
  const { workspace, user, role } = await getWorkspaceAccess(slug);
  const [goals, people] = await Promise.all([
    listGoals(workspace.id),
    listAssignableUsers(workspace.id),
  ]);
  const canEdit = can(role, "issues:update");
  const button = canEdit ? (
    <NewGoalButton
      slug={slug}
      people={people.map((p) => ({ id: p.id, name: p.name }))}
      currentUserId={user.id}
    />
  ) : null;
  if (!goals.length) {
    return (
      <EmptyState
        icon={TargetIcon}
        title="No goals yet"
        description="Set an outcome, like a launch or a quality target, and link the epics that get you there."
        action={button}
      />
    );
  }
  return (
    <div className="space-y-4">
      {button ? <div className="flex justify-end">{button}</div> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {goals.map((g) => (
          <Link
            key={g.id}
            href={`/${slug}/goals/${g.id}` as Route}
            className="group rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Card className="h-full gap-3 transition-colors group-hover:border-primary/40">
              <CardHeader>
                <CardTitle className="flex items-start justify-between gap-2">
                  <span className="line-clamp-2">{g.name}</span>
                  <GoalStatusBadge status={g.status} className="shrink-0" />
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                  {g.owner ? (
                    <>
                      <UserAvatar user={g.owner} className="size-4" />
                      {g.owner.name}
                    </>
                  ) : (
                    "No owner"
                  )}
                  {g.targetDate ? <span>· due {formatDate(g.targetDate)}</span> : null}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <GoalProgress progress={g.progress} />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function GoalsPage({ params }: Props) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Goals"
        description="Outcomes the workspace is working towards, and how close they are."
      />
      <Suspense fallback={<TableSkeleton />}>
        <GoalList params={params} />
      </Suspense>
    </div>
  );
}
