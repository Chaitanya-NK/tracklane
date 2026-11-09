import { can } from "@tracklane/core";
import { MessagesSquareIcon } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/shared/skeletons";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NewRetroButton, PHASE_LABELS } from "@/features/retros";
import { listRetroProjects, listRetros } from "@/features/retros/server";
import { formatDate } from "@/lib/format";
import { getWorkspaceAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Retros" };

type Props = PageProps<"/[workspace]/retros">;

async function Retros({ params }: { params: Props["params"] }) {
  const { workspace: slug } = await params;
  const { workspace, role } = await getWorkspaceAccess(slug);
  const [retros, projects] = await Promise.all([
    listRetros(workspace.id),
    listRetroProjects(workspace.id),
  ]);
  const button = can(role, "issues:update") ? (
    <NewRetroButton slug={slug} projects={projects} />
  ) : null;
  if (!retros.length) {
    return (
      <EmptyState
        icon={MessagesSquareIcon}
        title="No retros yet"
        description="Look back on a sprint together: add cards, vote, and turn action items into issues."
        action={button}
      />
    );
  }
  return (
    <div className="space-y-4">
      {button ? <div className="flex justify-end">{button}</div> : null}
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Retro</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Phase</TableHead>
              <TableHead className="text-right">Cards</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {retros.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link
                    href={`/${slug}/retros/${r.id}` as Route}
                    className="font-medium hover:underline"
                  >
                    {r.name}
                  </Link>
                  {r.sprint ? (
                    <span className="block text-xs text-muted-foreground">{r.sprint.name}</span>
                  ) : null}
                </TableCell>
                <TableCell>{r.project.name}</TableCell>
                <TableCell>
                  <Badge variant={r.phase === "closed" ? "outline" : "secondary"}>
                    {PHASE_LABELS[r.phase]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{r._count.cards}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(r.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function RetrosPage({ params }: Props) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Retrospectives"
        description="Brainstorm, vote and agree on actions after each sprint."
      />
      <Suspense fallback={<TableSkeleton />}>
        <Retros params={params} />
      </Suspense>
    </div>
  );
}
