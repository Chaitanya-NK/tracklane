import { can } from "@tracklane/core";
import { FolderIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/shared/skeletons";
import { CreateProjectDialog, ProjectsTable } from "@/features/projects";
import { listProjects } from "@/features/projects/server";
import { getWorkspaceAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Projects" };

async function CreateButton({ params }: { params: PageProps<"/[workspace]/projects">["params"] }) {
  const { workspace } = await params;
  const { role } = await getWorkspaceAccess(workspace);
  return can(role, "projects:create") ? <CreateProjectDialog slug={workspace} /> : null;
}

async function ProjectList({ params }: { params: PageProps<"/[workspace]/projects">["params"] }) {
  const { workspace: slug } = await params;
  const { workspace, role } = await getWorkspaceAccess(slug);
  const projects = await listProjects(workspace.id);
  if (projects.length === 0) {
    return (
      <EmptyState
        icon={FolderIcon}
        title="No projects yet"
        description={
          can(role, "projects:create")
            ? "Create a project to start tracking issues."
            : "Ask an admin or member to create a project."
        }
      />
    );
  }
  return <ProjectsTable slug={slug} projects={projects} />;
}

export default function ProjectsPage({ params }: PageProps<"/[workspace]/projects">) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Every project in this workspace."
        actions={
          <Suspense fallback={null}>
            <CreateButton params={params} />
          </Suspense>
        }
      />
      <Suspense fallback={<TableSkeleton rows={4} />}>
        <ProjectList params={params} />
      </Suspense>
    </div>
  );
}
