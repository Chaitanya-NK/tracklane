import { can } from "@tracklane/core";
import { LockIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { HeadingSkeleton, TableSkeleton } from "@/components/shared/skeletons";
import { AuditLog } from "@/features/audit";
import { listAuditActors, listAuditEvents, parseAuditFilters } from "@/features/audit/server";
import { getWorkspaceAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Audit log" };

type Props = PageProps<"/[workspace]/settings/audit">;

async function Audit({ params, searchParams }: Props) {
  const [{ workspace: slug }, query] = await Promise.all([params, searchParams]);
  const { workspace, role, user } = await getWorkspaceAccess(slug);
  if (!can(role, "workspace:update")) {
    return (
      <EmptyState
        icon={LockIcon}
        title="Admins only"
        description="Ask a workspace admin if you need to know who changed what."
      />
    );
  }
  const [page, actors] = await Promise.all([
    listAuditEvents({
      workspaceId: workspace.id,
      userId: user.id,
      filters: parseAuditFilters(query),
    }),
    listAuditActors(workspace.id),
  ]);
  return <AuditLog slug={slug} events={page.events} nextCursor={page.nextCursor} actors={actors} />;
}

export default function AuditPage(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <HeadingSkeleton />
          <TableSkeleton />
        </div>
      }
    >
      <Audit {...props} />
    </Suspense>
  );
}
