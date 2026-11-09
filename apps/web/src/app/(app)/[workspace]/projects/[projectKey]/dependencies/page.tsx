import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { DependencyGraph } from "@/features/links";
import { getDependencyGraph } from "@/features/links/server";
import { getProjectAccess } from "@/server/authz";
import { NetworkIcon } from "lucide-react";

export const metadata: Metadata = { title: "Dependencies" };

type Props = PageProps<"/[workspace]/projects/[projectKey]/dependencies">;

async function Dependencies({ params, searchParams }: Props) {
  const [{ workspace: slug, projectKey }, query] = await Promise.all([params, searchParams]);
  const { project } = await getProjectAccess(slug, projectKey);
  const includeDone = query.done === "1";
  const graph = await getDependencyGraph(project.id, includeDone);
  const base = `/${slug}/projects/${project.key}/dependencies`;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Issues linked with &ldquo;blocks&rdquo;, in the order they can be done. Add links from an
          issue&apos;s Linked issues section.
        </p>
        <Button variant="ghost" size="sm" asChild>
          <Link href={(includeDone ? base : `${base}?done=1`) as Route}>
            {includeDone ? "Hide done" : "Include done"}
          </Link>
        </Button>
      </div>
      {graph.nodes.length ? (
        <DependencyGraph slug={slug} nodes={graph.nodes} edges={graph.edges} />
      ) : (
        <EmptyState
          icon={NetworkIcon}
          title="No dependencies"
          description={
            includeDone ? "No issues here block others." : "No open issues here block others."
          }
        />
      )}
    </div>
  );
}

export default function DependenciesPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-80 w-full" />}>
      <Dependencies {...props} />
    </Suspense>
  );
}
