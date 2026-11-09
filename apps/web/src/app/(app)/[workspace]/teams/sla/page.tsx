import type { Metadata } from "next";
import { Suspense } from "react";
import { TableSkeleton } from "@/components/shared/skeletons";
import { SlaOverview } from "@/features/sla";
import { slaOverview } from "@/features/sla/server";
import { getWorkspaceAccess } from "@/server/authz";

export const metadata: Metadata = { title: "SLAs" };

async function Overview({ params }: PageProps<"/[workspace]/teams/sla">) {
  const { workspace: slug } = await params;
  const { workspace } = await getWorkspaceAccess(slug);
  return <SlaOverview slug={slug} overview={await slaOverview(workspace.id)} />;
}

export default function SlaPage(props: PageProps<"/[workspace]/teams/sla">) {
  return (
    <Suspense fallback={<TableSkeleton rows={6} />}>
      <Overview {...props} />
    </Suspense>
  );
}
