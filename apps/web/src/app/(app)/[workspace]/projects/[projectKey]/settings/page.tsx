import { can } from "@tracklane/core";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CardSkeleton } from "@/components/shared/skeletons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteProjectDialog, LabelsManager, ProjectSettingsForm } from "@/features/projects";
import { listAssignableUsers, listLabels } from "@/features/projects/server";
import { getProjectAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Project settings" };

type Props = PageProps<"/[workspace]/projects/[projectKey]/settings">;

async function Settings({ params }: { params: Props["params"] }) {
  const { workspace: slug, projectKey } = await params;
  const { workspace, project, role } = await getProjectAccess(slug, projectKey);
  const [members, labels] = await Promise.all([
    listAssignableUsers(workspace.id),
    listLabels(project.id),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>Name, lead and description.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectSettingsForm
            key={`${project.name}:${project.leadId}:${project.description.length}`}
            slug={slug}
            project={project}
            members={members}
            canEdit={can(role, "projects:update")}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Labels</CardTitle>
          <CardDescription>Tag issues for filtering and reports.</CardDescription>
        </CardHeader>
        <CardContent>
          <LabelsManager
            slug={slug}
            projectKey={project.key}
            labels={labels}
            canEdit={can(role, "issues:update")}
            canDelete={can(role, "projects:update")}
          />
        </CardContent>
      </Card>
      {can(role, "projects:delete") ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>Delete project</CardTitle>
            <CardDescription>
              Permanently remove this project and all of its issues.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeleteProjectDialog slug={slug} project={project} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export default function ProjectSettingsPage({ params }: Props) {
  return (
    <Suspense fallback={<CardSkeleton lines={3} />}>
      <Settings params={params} />
    </Suspense>
  );
}
