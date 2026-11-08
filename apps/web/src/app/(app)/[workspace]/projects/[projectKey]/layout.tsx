import { Suspense } from "react";
import { HeadingSkeleton } from "@/components/shared/skeletons";
import { ProjectAvatar, ProjectTabs } from "@/features/projects";
import { getProjectAccess } from "@/server/authz";

async function ProjectHeading({
  params,
}: {
  params: LayoutProps<"/[workspace]/projects/[projectKey]">["params"];
}) {
  const { workspace, projectKey } = await params;
  const { project } = await getProjectAccess(workspace, projectKey);
  return (
    <div className="flex items-center gap-3">
      <ProjectAvatar projectKey={project.key} className="size-10 text-xs" />
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold tracking-tight">{project.name}</h1>
        <p className="text-sm text-muted-foreground">
          <span className="font-mono">{project.key}</span> ·{" "}
          {project.type === "scrum" ? "Scrum" : "Kanban"} project
        </p>
      </div>
    </div>
  );
}

export default function ProjectLayout({
  children,
  params,
}: LayoutProps<"/[workspace]/projects/[projectKey]">) {
  return (
    <div className="space-y-5">
      <Suspense fallback={<HeadingSkeleton />}>
        <ProjectHeading params={params} />
      </Suspense>
      <ProjectTabs />
      {children}
    </div>
  );
}
