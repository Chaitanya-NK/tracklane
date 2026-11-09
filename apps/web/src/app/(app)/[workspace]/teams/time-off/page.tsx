import { can } from "@tracklane/core";
import type { Metadata } from "next";
import { Suspense } from "react";
import { TableSkeleton } from "@/components/shared/skeletons";
import { listAssignableUsers } from "@/features/projects/server";
import { TimeOffManager } from "@/features/time";
import { listTimeOff } from "@/features/time/server";
import { getWorkspaceAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Time off" };

async function TimeOff({ params }: PageProps<"/[workspace]/teams/time-off">) {
  const { workspace: slug } = await params;
  const { workspace, user, role } = await getWorkspaceAccess(slug);
  const today = new Date(new Date().toISOString().slice(0, 10));
  const [items, people] = await Promise.all([
    listTimeOff(workspace.id, today),
    listAssignableUsers(workspace.id),
  ]);
  return (
    <TimeOffManager
      slug={slug}
      items={items}
      people={people}
      currentUserId={user.id}
      isAdmin={can(role, "members:update_role")}
    />
  );
}

export default function TimeOffPage(props: PageProps<"/[workspace]/teams/time-off">) {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <TimeOff {...props} />
    </Suspense>
  );
}
