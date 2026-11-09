import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { PortalForm } from "@/features/public-pages";
import { getPortal } from "@/features/public-pages/server";

export const metadata: Metadata = { title: "Request portal", robots: { index: false } };

type Props = PageProps<"/portal/[workspace]/[projectKey]">;

async function Portal({ params }: { params: Props["params"] }) {
  const { workspace, projectKey } = await params;
  const portal = await getPortal(workspace, projectKey);
  if (!portal) notFound();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">{portal.workspace.name}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{portal.name}: get help</h1>
        <p className="text-muted-foreground">
          Report a problem or ask for something. The team sees it right away, and you get a link to
          follow it.
        </p>
      </header>
      <PortalForm slug={portal.workspace.slug} projectKey={portal.key} />
    </div>
  );
}

export default function PortalPage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 max-w-2xl" />}>
      <Portal params={params} />
    </Suspense>
  );
}
