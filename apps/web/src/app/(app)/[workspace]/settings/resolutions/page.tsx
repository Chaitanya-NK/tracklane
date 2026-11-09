import { can } from "@tracklane/core";
import type { Metadata } from "next";
import { Suspense } from "react";
import { HeadingSkeleton, TableSkeleton } from "@/components/shared/skeletons";
import { ResolutionsManager } from "@/features/resolutions";
import { listResolutions } from "@/features/resolutions/server";
import { getWorkspaceAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Resolutions" };

type Props = PageProps<"/[workspace]/settings/resolutions">;

async function Resolutions({ params }: { params: Props["params"] }) {
  const { workspace: slug } = await params;
  const { workspace, role } = await getWorkspaceAccess(slug);
  const resolutions = await listResolutions(workspace.id);
  return (
    <ResolutionsManager
      slug={workspace.slug}
      resolutions={resolutions}
      canManage={can(role, "workspace:update")}
    />
  );
}

export default function ResolutionsSettingsPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <HeadingSkeleton />
          <TableSkeleton />
        </div>
      }
    >
      <Resolutions params={params} />
    </Suspense>
  );
}
