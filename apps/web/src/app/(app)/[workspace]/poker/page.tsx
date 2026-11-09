import { can } from "@tracklane/core";
import { SpadeIcon } from "lucide-react";
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
import { NewPokerButton } from "@/features/poker";
import { listPokerCandidates, listPokerSessions } from "@/features/poker/server";
import { formatDate } from "@/lib/format";
import { getWorkspaceAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Planning poker" };

type Props = PageProps<"/[workspace]/poker">;

async function Sessions({ params }: { params: Props["params"] }) {
  const { workspace: slug } = await params;
  const { workspace, role } = await getWorkspaceAccess(slug);
  const [sessions, candidates] = await Promise.all([
    listPokerSessions(workspace.id),
    listPokerCandidates(workspace.id),
  ]);
  const button = can(role, "issues:update") ? (
    <NewPokerButton slug={slug} projects={candidates} />
  ) : null;
  if (!sessions.length) {
    return (
      <EmptyState
        icon={SpadeIcon}
        title="No sessions yet"
        description="Estimate the backlog together: everyone votes in secret, then you reveal and agree."
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
              <TableHead>Session</TableHead>
              <TableHead>Project</TableHead>
              <TableHead className="text-right">Issues</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Started</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <Link
                    href={`/${slug}/poker/${s.id}` as Route}
                    className="font-medium hover:underline"
                  >
                    {s.name}
                  </Link>
                  {s.createdBy ? (
                    <span className="block text-xs text-muted-foreground">
                      by {s.createdBy.name}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>{s.project.name}</TableCell>
                <TableCell className="text-right tabular-nums">{s.queue.length}</TableCell>
                <TableCell>
                  <Badge variant={s.endedAt ? "outline" : "secondary"}>
                    {s.endedAt ? "Ended" : "Open"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(s.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function PokerPage({ params }: Props) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Planning poker"
        description="Estimate together, live. Agreed estimates are saved on the issues."
      />
      <Suspense fallback={<TableSkeleton />}>
        <Sessions params={params} />
      </Suspense>
    </div>
  );
}
