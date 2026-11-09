import { can } from "@tracklane/core";
import { LockIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { CardSkeleton } from "@/components/shared/skeletons";
import { StatusAdmin } from "@/features/public-pages";
import { getStatusAdmin } from "@/features/public-pages/server";
import { getWorkspaceAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Status page" };

type Props = PageProps<"/[workspace]/settings/status">;

async function Status({ params }: { params: Props["params"] }) {
  const { workspace: slug } = await params;
  const { workspace, role } = await getWorkspaceAccess(slug);
  if (!can(role, "workspace:update")) {
    return (
      <EmptyState
        icon={LockIcon}
        title="Admins only"
        description="Ask a workspace admin to update the status page."
      />
    );
  }
  return <StatusAdmin slug={slug} data={await getStatusAdmin(workspace.id)} />;
}

export default function StatusSettingsPage({ params }: Props) {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <Status params={params} />
    </Suspense>
  );
}
