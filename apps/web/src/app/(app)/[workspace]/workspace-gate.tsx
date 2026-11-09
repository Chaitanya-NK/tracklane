import { after } from "next/server";
import { RealtimeProvider } from "@/components/shared/realtime";
import { VerifyEmailBanner } from "@/components/shared/verify-email-banner";
import { rememberLastWorkspace } from "@/features/workspaces/server";
import { getCurrentUser } from "@/server/auth/session";
import { getWorkspaceAccess } from "@/server/authz";

export async function WorkspaceGate({
  params,
  children,
}: {
  params: Promise<{ workspace: string }>;
  children: React.ReactNode;
}) {
  const { workspace: slug } = await params;
  const [{ user, workspace }, current] = await Promise.all([
    getWorkspaceAccess(slug),
    getCurrentUser(),
  ]);
  after(() => rememberLastWorkspace(user.id, workspace.id));
  return (
    <RealtimeProvider userId={user.id}>
      {current && !current.emailVerified ? <VerifyEmailBanner email={current.email} /> : null}
      {children}
    </RealtimeProvider>
  );
}
