import { Suspense } from "react";
import { LiveRefresh, liveRooms } from "@/components/shared/realtime";
import { HeadingSkeleton } from "@/components/shared/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectAvatar, ProjectTabs } from "@/features/projects";
import { getProjectAccess } from "@/server/authz";

type Props = LayoutProps<"/[workspace]/projects/[projectKey]">;

async function ProjectHeading({ params }: { params: Props["params"] }) {
  const { workspace, projectKey } = await params;
  const { project, workspace: ws } = await getProjectAccess(workspace, projectKey);
  return (
    <div className="space-y-4">
      {/* Board, backlog and lists refresh when someone else changes an issue in this project. */}
      <LiveRefresh rooms={[liveRooms.project(ws.id, project.id)]} />
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
      <ProjectTabs />
    </div>
  );
}

/**
 * Project frame. `quickview` is a parallel route: issue links clicked on project pages open the
 * issue in a side sheet (see @quickview), while direct visits render the full issue page.
 */
export default function ProjectLayout({ children, params, quickview }: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <Suspense
        fallback={
          <div className="space-y-4">
            <HeadingSkeleton />
            <Skeleton className="h-9 w-72" />
          </div>
        }
      >
        <ProjectHeading params={params} />
      </Suspense>
      {children}
      {quickview}
    </div>
  );
}
