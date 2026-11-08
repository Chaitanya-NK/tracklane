import type { Metadata } from "next";
import { HomeOverview } from "@/features/home";
import { getWorkspaceAccess } from "@/server/authz";

export const metadata: Metadata = { title: "For you" };

export default async function HomePage({ params }: PageProps<"/[workspace]">) {
  const { workspace } = await params;
  const { user, workspace: current } = await getWorkspaceAccess(workspace);
  return <HomeOverview userName={user.name} workspaceName={current.name} />;
}
