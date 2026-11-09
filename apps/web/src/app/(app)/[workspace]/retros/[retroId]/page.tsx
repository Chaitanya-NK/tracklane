import { can } from "@tracklane/core";
import { ArrowLeftIcon } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { liveRooms, LiveRefresh, Viewers } from "@/components/shared/realtime";
import { HeadingSkeleton, TableSkeleton } from "@/components/shared/skeletons";
import { Button } from "@/components/ui/button";
import { RetroBoard } from "@/features/retros";
import { getRetro } from "@/features/retros/server";
import { getWorkspaceAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Retro" };

type Props = PageProps<"/[workspace]/retros/[retroId]">;

async function Retro({ params }: { params: Props["params"] }) {
  const { workspace: slug, retroId } = await params;
  const { workspace, user, role } = await getWorkspaceAccess(slug);
  const retro = await getRetro(workspace.id, retroId, user.id);
  if (!retro) notFound();
  const room = liveRooms.item(workspace.id, "retro", retro.id);
  return (
    <div className="space-y-4">
      <LiveRefresh rooms={[room]} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <Button variant="ghost" size="icon" asChild className="size-8">
            <Link href={`/${slug}/retros` as Route} aria-label="All retros">
              <ArrowLeftIcon />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold">{retro.name}</h1>
            <p className="text-sm text-muted-foreground">
              {retro.project.name}
              {retro.sprint ? ` · ${retro.sprint.name}` : ""}
            </p>
          </div>
        </div>
        <Viewers room={room} />
      </div>
      <RetroBoard
        slug={slug}
        retro={retro}
        canEdit={can(role, "issues:update") && retro.phase !== "closed"}
        canFacilitate={retro.createdById === user.id || can(role, "projects:update")}
      />
    </div>
  );
}

export default function RetroPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <HeadingSkeleton />
          <TableSkeleton />
        </div>
      }
    >
      <Retro params={params} />
    </Suspense>
  );
}
