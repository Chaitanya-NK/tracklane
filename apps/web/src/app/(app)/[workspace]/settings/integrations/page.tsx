import { can } from "@tracklane/core";
import { db } from "@tracklane/db";
import type { Metadata } from "next";
import { Suspense } from "react";
import { TableSkeleton } from "@/components/shared/skeletons";
import { env } from "@/env";
import { IntegrationsSettings } from "@/features/integrations";
import { getIntegrations } from "@/features/integrations/server";
import { getWorkspaceAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Integrations" };

async function Integrations({ params }: PageProps<"/[workspace]/settings/integrations">) {
  const { workspace: slug } = await params;
  const { workspace, role } = await getWorkspaceAccess(slug);
  const [state, projects] = await Promise.all([
    getIntegrations(workspace.id),
    db.project.findMany({
      where: { workspaceId: workspace.id, archivedAt: null },
      orderBy: { name: "asc" },
      select: { key: true, name: true },
    }),
  ]);
  return (
    <IntegrationsSettings
      slug={slug}
      state={state}
      canEdit={can(role, "workspace:update")}
      projects={projects}
      webhookUrl={`${env.NEXT_PUBLIC_APP_URL}/api/integrations/github/${workspace.id}`}
    />
  );
}

export default function IntegrationsPage(props: PageProps<"/[workspace]/settings/integrations">) {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <Integrations {...props} />
    </Suspense>
  );
}
