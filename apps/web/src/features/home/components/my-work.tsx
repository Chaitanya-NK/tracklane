import { CircleCheckIcon, ClockIcon, InboxIcon, PencilLineIcon, UserIcon } from "lucide-react";
import { cache } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { IssueTable } from "@/features/issues";
import { getMyWork } from "@/features/issues/server";
import { getWorkspaceAccess } from "@/server/authz";

const loadMyWork = cache(async (slug: string) => {
  const { workspace, user } = await getWorkspaceAccess(slug);
  return getMyWork(workspace.id, user.id);
});

const STAT_TILES = [
  { key: "assignedOpen", label: "Assigned to me", icon: UserIcon },
  { key: "dueSoon", label: "Due within 7 days", icon: ClockIcon },
  { key: "reportedOpen", label: "Reported by me, open", icon: PencilLineIcon },
  { key: "doneThisWeek", label: "Done in the last 7 days", icon: CircleCheckIcon },
] as const;

function StatGrid({ values }: { values?: Record<(typeof STAT_TILES)[number]["key"], number> }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {STAT_TILES.map((tile) => (
        <Card key={tile.key} className="gap-3 py-5">
          <CardHeader className="flex flex-row items-center justify-between px-5">
            <CardDescription className="font-medium">{tile.label}</CardDescription>
            <tile.icon className="size-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent className="px-5">
            {values ? (
              <p className="text-3xl font-semibold tracking-tight tabular-nums">
                {values[tile.key]}
              </p>
            ) : (
              <Skeleton className="h-9 w-12" />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function MyStatsFallback() {
  return <StatGrid />;
}

export async function MyStats({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  const { stats } = await loadMyWork(workspace);
  return <StatGrid values={stats} />;
}

export async function MyAssignedIssues({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  const { issues } = await loadMyWork(workspace);
  if (issues.length === 0) {
    return (
      <EmptyState
        icon={InboxIcon}
        title="Nothing assigned to you"
        description="Issues assigned to you in any project show up here."
      />
    );
  }
  return <IssueTable slug={workspace} issues={issues} showProject />;
}
