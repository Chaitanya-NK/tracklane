import type { Metadata } from "next";
import { Suspense } from "react";
import { TableSkeleton } from "@/components/shared/skeletons";
import { WorkloadTable } from "@/features/reports";
import { getWorkload } from "@/features/reports/server";
import { weekStart } from "@/features/time/server";
import { getWorkspaceAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Workload" };

type Props = PageProps<"/[workspace]/teams">;

async function Workload({ params }: { params: Props["params"] }) {
  const { workspace: slug } = await params;
  const { workspace } = await getWorkspaceAccess(slug);
  const rows = await getWorkload(workspace.id, undefined, weekStart(new Date()));
  return <WorkloadTable rows={rows} />;
}

export default function WorkloadPage({ params }: Props) {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <Workload params={params} />
    </Suspense>
  );
}
