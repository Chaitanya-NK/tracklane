import { can } from "@tracklane/core";
import { ArrowLeftIcon } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { liveRooms, LiveRefresh, Viewers } from "@/components/shared/realtime";
import { HeadingSkeleton, TableSkeleton } from "@/components/shared/skeletons";
import { Button } from "@/components/ui/button";
import { PokerRoom } from "@/features/poker";
import { getPokerSession } from "@/features/poker/server";
import { getWorkspaceAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Planning poker" };

type Props = PageProps<"/[workspace]/poker/[sessionId]">;

async function Session({ params }: { params: Props["params"] }) {
  const { workspace: slug, sessionId } = await params;
  const { workspace, user, role } = await getWorkspaceAccess(slug);
  const session = await getPokerSession(workspace.id, sessionId, user.id);
  if (!session) notFound();
  const room = liveRooms.item(workspace.id, "poker", session.id);
  return (
    <div className="space-y-4">
      <LiveRefresh rooms={[room]} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <Button variant="ghost" size="icon" asChild className="size-8">
            <Link href={`/${slug}/poker` as Route} aria-label="All sessions">
              <ArrowLeftIcon />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold">{session.name}</h1>
            <p className="text-sm text-muted-foreground">{session.project.name}</p>
          </div>
        </div>
        <Viewers room={room} />
      </div>
      <PokerRoom
        slug={slug}
        session={session}
        canVote={can(role, "issues:update")}
        canFacilitate={session.createdById === user.id || can(role, "projects:update")}
      />
    </div>
  );
}

export default function PokerSessionPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <HeadingSkeleton />
          <TableSkeleton />
        </div>
      }
    >
      <Session params={params} />
    </Suspense>
  );
}
