import { can } from "@tracklane/core";
import type { Metadata } from "next";
import { Suspense } from "react";
import { HeadingSkeleton, TableSkeleton } from "@/components/shared/skeletons";
import { ApiTokensManager } from "@/features/api-tokens";
import { listApiTokens } from "@/features/api-tokens/server";
import { getWorkspaceAccess } from "@/server/authz";

export const metadata: Metadata = { title: "API tokens" };

type Props = PageProps<"/[workspace]/settings/api">;

async function Tokens({ params }: { params: Props["params"] }) {
  const { workspace: slug } = await params;
  const { workspace, user, role } = await getWorkspaceAccess(slug);
  const tokens = await listApiTokens(workspace.id, user.id);
  return <ApiTokensManager slug={slug} tokens={tokens} canWrite={can(role, "issues:update")} />;
}

export default function ApiTokensPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <HeadingSkeleton />
          <TableSkeleton />
        </div>
      }
    >
      <Tokens params={params} />
    </Suspense>
  );
}
