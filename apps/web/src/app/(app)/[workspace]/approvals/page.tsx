import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/shared/skeletons";
import { ApprovalsInbox } from "@/features/workflow";
import { countApprovalsWaiting, listApprovalInbox } from "@/features/workflow/server";
import { getWorkspaceAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Approvals" };

type Props = PageProps<"/[workspace]/approvals">;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function Approvals({ params, searchParams }: Props) {
  const [{ workspace: slug }, sp] = await Promise.all([params, searchParams]);
  const { workspace, user, role } = await getWorkspaceAccess(slug);
  const raw = first(sp.tab);
  const tab = raw === "mine" || raw === "done" ? raw : "waiting";
  const [requests, waitingCount] = await Promise.all([
    listApprovalInbox({ workspaceId: workspace.id, userId: user.id, role, tab }),
    countApprovalsWaiting(workspace.id, role),
  ]);
  return (
    <ApprovalsInbox
      slug={slug}
      tab={tab}
      requests={requests}
      selectedId={first(sp.r) ?? null}
      waitingCount={waitingCount}
    />
  );
}

export default function ApprovalsPage(props: Props) {
  return (
    <div className="space-y-6">
      <PageHeader title="Approvals" description="Status changes waiting for a sign-off." />
      <Suspense fallback={<TableSkeleton rows={5} />}>
        <Approvals {...props} />
      </Suspense>
    </div>
  );
}
