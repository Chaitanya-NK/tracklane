import { can } from "@tracklane/core";
import { LockIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { HeadingSkeleton, TableSkeleton } from "@/components/shared/skeletons";
import { WebhooksManager } from "@/features/webhooks";
import { listWebhooks } from "@/features/webhooks/server";
import { getWorkspaceAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Webhooks" };

type Props = PageProps<"/[workspace]/settings/webhooks">;

async function Webhooks({ params }: { params: Props["params"] }) {
  const { workspace: slug } = await params;
  const { workspace, role } = await getWorkspaceAccess(slug);
  if (!can(role, "workspace:update")) {
    return (
      <EmptyState
        icon={LockIcon}
        title="Admins only"
        description="Ask a workspace admin to set up webhooks."
      />
    );
  }
  const hooks = await listWebhooks(workspace.id);
  return <WebhooksManager slug={slug} hooks={hooks} />;
}

export default function WebhooksPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <HeadingSkeleton />
          <TableSkeleton />
        </div>
      }
    >
      <Webhooks params={params} />
    </Suspense>
  );
}
