import { after } from "next/server";
import { rememberLastWorkspace } from "@/features/workspaces/server";
import { getWorkspaceAccess } from "@/server/authz";

export async function WorkspaceGate({
  params,
  children,
}: {
  params: Promise<{ workspace: string }>;
  children: React.ReactNode;
}) {
  const { workspace: slug } = await params;
  const { user, workspace } = await getWorkspaceAccess(slug);
  after(() => rememberLastWorkspace(user.id, workspace.id));
  return children;
}
