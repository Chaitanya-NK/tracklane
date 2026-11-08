import { can } from "@tracklane/core";
import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteWorkspaceDialog, WorkspaceGeneralForm } from "@/features/workspaces";
import { getWorkspaceAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Settings" };

export default async function GeneralSettingsPage({ params }: PageProps<"/[workspace]/settings">) {
  const { workspace: slug } = await params;
  const { workspace, role } = await getWorkspaceAccess(slug);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>The workspace name and the URL people use to reach it.</CardDescription>
        </CardHeader>
        <CardContent>
          <WorkspaceGeneralForm
            key={`${workspace.name}:${workspace.slug}`}
            workspace={workspace}
            canEdit={can(role, "workspace:update")}
          />
        </CardContent>
      </Card>

      {can(role, "workspace:delete") ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>Delete workspace</CardTitle>
            <CardDescription>
              Permanently remove this workspace and everything in it. Only owners can do this.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeleteWorkspaceDialog workspace={workspace} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
