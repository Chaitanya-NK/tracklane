import { can } from "@tracklane/core";
import type { Metadata } from "next";
import { Suspense } from "react";
import { HeadingSkeleton, TableSkeleton } from "@/components/shared/skeletons";
import { TqlFunctionsManager } from "@/features/search";
import { getTqlCatalog, listTqlFunctions } from "@/features/search/server";
import { getWorkspaceAccess } from "@/server/authz";

export const metadata: Metadata = { title: "TQL functions" };

async function FunctionsSettings({
  params,
}: {
  params: PageProps<"/[workspace]/settings/functions">["params"];
}) {
  const { workspace: slug } = await params;
  const { user, workspace, role } = await getWorkspaceAccess(slug);
  const [functions, catalog] = await Promise.all([
    listTqlFunctions(workspace.id),
    getTqlCatalog(workspace.id, user.id),
  ]);
  return (
    <TqlFunctionsManager
      slug={workspace.slug}
      canManage={can(role, "workspace:update")}
      catalog={catalog}
      functions={functions.map((f) => ({
        id: f.id,
        name: f.name,
        description: f.description,
        kind: f.kind,
        body: f.body,
        valueKind: f.valueKind,
        values: f.values,
        createdByName: f.createdBy?.name ?? null,
      }))}
    />
  );
}

export default function FunctionsSettingsPage({
  params,
}: PageProps<"/[workspace]/settings/functions">) {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <HeadingSkeleton />
          <TableSkeleton />
        </div>
      }
    >
      <FunctionsSettings params={params} />
    </Suspense>
  );
}
