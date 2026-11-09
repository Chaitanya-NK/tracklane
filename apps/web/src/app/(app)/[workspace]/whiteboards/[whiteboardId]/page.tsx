import { can } from "@tracklane/core";
import { ArrowLeftIcon } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { liveRooms, Viewers } from "@/components/shared/realtime";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WhiteboardCanvas, WhiteboardTitle } from "@/features/whiteboards";
import { getWhiteboard } from "@/features/whiteboards/server";
import { getWorkspaceAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Whiteboard" };

type Props = PageProps<"/[workspace]/whiteboards/[whiteboardId]">;

async function Board({ params }: { params: Props["params"] }) {
  const { workspace: slug, whiteboardId } = await params;
  const { workspace, role } = await getWorkspaceAccess(slug);
  const board = await getWhiteboard(workspace.id, whiteboardId);
  if (!board) notFound();
  const room = liveRooms.item(workspace.id, "whiteboard", board.id);
  const canEdit = can(role, "issues:update");
  return (
    <div className="flex h-[calc(100svh-7.5rem)] min-h-[28rem] flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <Button variant="ghost" size="icon" asChild className="size-8">
            <Link href={`/${slug}/whiteboards` as Route} aria-label="All whiteboards">
              <ArrowLeftIcon />
            </Link>
          </Button>
          <WhiteboardTitle slug={slug} id={board.id} name={board.name} canEdit={canEdit} />
        </div>
        <Viewers room={room} />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border">
        <WhiteboardCanvas
          slug={slug}
          id={board.id}
          room={room}
          initialScene={board.scene as { elements?: unknown[]; viewBackgroundColor?: string }}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}

export default function WhiteboardPage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-[calc(100svh-7.5rem)] w-full" />}>
      <Board params={params} />
    </Suspense>
  );
}
