import { can } from "@tracklane/core";
import type { Metadata } from "next";
import { Suspense } from "react";
import { HeadingSkeleton, TableSkeleton } from "@/components/shared/skeletons";
import { ApiTokensManager, ApiUsagePanel } from "@/features/api-tokens";
import { getApiUsage, listApiTokens } from "@/features/api-tokens/server";
import { getWorkspaceAccess } from "@/server/authz";

export const metadata: Metadata = { title: "API tokens" };

type Props = PageProps<"/[workspace]/settings/api">;

async function Tokens({ params }: { params: Props["params"] }) {
  const { workspace: slug } = await params;
  const { workspace, user, role } = await getWorkspaceAccess(slug);
  const [tokens, usage] = await Promise.all([
    listApiTokens(workspace.id, user.id),
    can(role, "workspace:update") ? getApiUsage(workspace.id) : Promise.resolve(null),
  ]);
  return (
    <div className="space-y-8">
      {usage ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">API usage</h2>
          <ApiUsagePanel usage={usage} />
        </section>
      ) : null}
      <ApiTokensManager slug={slug} tokens={tokens} canWrite={can(role, "issues:update")} />
    </div>
  );
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
