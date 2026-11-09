import { can } from "@tracklane/core";
import { FileTextIcon } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/shared/skeletons";
import { TimeAgo } from "@/components/shared/time-ago";
import { Badge } from "@/components/ui/badge";
import { DocTree, NewDocButton } from "@/features/docs";
import { listDocs } from "@/features/docs/server";
import { listProjects } from "@/features/projects/server";
import { getWorkspaceAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Docs" };

type Props = PageProps<"/[workspace]/docs">;

async function Docs({ params }: { params: Props["params"] }) {
  const { workspace: slug } = await params;
  const { workspace, role } = await getWorkspaceAccess(slug);
  const [docs, projects] = await Promise.all([listDocs(workspace.id), listProjects(workspace.id)]);
  const canEdit = can(role, "issues:update");
  const options = projects.map((p) => ({ id: p.id, name: p.name }));
  const spaces = [
    { id: null as string | null, name: "Workspace" },
    ...projects
      .filter((p) => docs.some((d) => d.projectId === p.id))
      .map((p) => ({ id: p.id as string | null, name: p.name })),
  ];
  const recent = [...docs].sort((a, b) => +b.updatedAt - +a.updatedAt).slice(0, 6);

  if (!docs.length) {
    return (
      <EmptyState
        icon={FileTextIcon}
        title="No pages yet"
        description="Write specs, runbooks and meeting notes in Markdown, with diagrams as code."
        action={canEdit ? <NewDocButton slug={slug} projects={options} /> : null}
      />
    );
  }
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-6">
        {canEdit ? (
          <div className="flex justify-end lg:hidden">
            <NewDocButton slug={slug} projects={options} />
          </div>
        ) : null}
        {spaces.map((space) => {
          const inSpace = docs.filter((d) => d.projectId === space.id);
          if (!inSpace.length) return null;
          return (
            <section key={space.id ?? "workspace"} className="space-y-2" aria-label={space.name}>
              <h2 className="text-sm font-semibold">
                {space.name}{" "}
                <span className="font-normal text-muted-foreground">({inSpace.length})</span>
              </h2>
              <div className="rounded-lg border p-2">
                <DocTree slug={slug} docs={inSpace} />
              </div>
            </section>
          );
        })}
      </div>
      <aside className="space-y-3">
        {canEdit ? (
          <div className="hidden lg:block">
            <NewDocButton slug={slug} projects={options} />
          </div>
        ) : null}
        <h2 className="text-sm font-semibold">Recently updated</h2>
        <ul className="space-y-2">
          {recent.map((d) => (
            <li key={d.id} className="text-sm">
              <Link href={`/${slug}/docs/${d.id}` as Route} className="font-medium hover:underline">
                {d.title}
              </Link>
              <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                {d.project ? <Badge variant="outline">{d.project.key}</Badge> : null}
                {d.updatedBy?.name ?? "Someone"} · <TimeAgo date={d.updatedAt} />
              </p>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

export default function DocsPage({ params }: Props) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Docs"
        description="Pages for the workspace and its projects, with version history."
      />
      <Suspense fallback={<TableSkeleton />}>
        <Docs params={params} />
      </Suspense>
    </div>
  );
}
