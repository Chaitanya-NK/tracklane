import { can } from "@tracklane/core";
import { PenToolIcon } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/shared/skeletons";
import { TimeAgo } from "@/components/shared/time-ago";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listProjects } from "@/features/projects/server";
import { NewWhiteboardButton } from "@/features/whiteboards";
import { listWhiteboards } from "@/features/whiteboards/server";
import { getWorkspaceAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Whiteboards" };

type Props = PageProps<"/[workspace]/whiteboards">;

async function Boards({ params }: { params: Props["params"] }) {
  const { workspace: slug } = await params;
  const { workspace, role } = await getWorkspaceAccess(slug);
  const [boards, projects] = await Promise.all([
    listWhiteboards(workspace.id),
    listProjects(workspace.id),
  ]);
  const button = can(role, "issues:update") ? (
    <NewWhiteboardButton slug={slug} projects={projects.map((p) => ({ id: p.id, name: p.name }))} />
  ) : null;
  if (!boards.length) {
    return (
      <EmptyState
        icon={PenToolIcon}
        title="No whiteboards yet"
        description="Sketch flows and run workshops together, live."
        action={button}
      />
    );
  }
  return (
    <div className="space-y-4">
      {button ? <div className="flex justify-end">{button}</div> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {boards.map((b) => (
          <Link
            key={b.id}
            href={`/${slug}/whiteboards/${b.id}` as Route}
            className="group rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Card className="h-full transition-colors group-hover:border-primary/40">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span className="truncate">{b.name}</span>
                  {b.project ? <Badge variant="outline">{b.project.key}</Badge> : null}
                </CardTitle>
                <CardDescription>
                  Updated <TimeAgo date={b.updatedAt} />
                  {b.createdBy ? ` · by ${b.createdBy.name}` : ""}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function WhiteboardsPage({ params }: Props) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Whiteboards"
        description="Shared canvases. Changes appear for everyone as they're drawn."
      />
      <Suspense fallback={<TableSkeleton />}>
        <Boards params={params} />
      </Suspense>
    </div>
  );
}
