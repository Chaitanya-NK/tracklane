import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { HeadingSkeleton } from "@/components/shared/skeletons";
import { HomeOverview } from "@/features/home";
import { getWorkspaceAccess } from "@/server/authz";

export const metadata: Metadata = { title: "For you" };

async function Greeting({ params }: { params: PageProps<"/[workspace]">["params"] }) {
  const { workspace: slug } = await params;
  const { user, workspace } = await getWorkspaceAccess(slug);
  return (
    <PageHeader
      title={`Welcome, ${user.name.split(" ")[0] || user.name}`}
      description={`Your assigned work, activity and sprint progress in ${workspace.name} will appear here.`}
    />
  );
}

export default function HomePage({ params }: PageProps<"/[workspace]">) {
  return (
    <HomeOverview
      header={
        <Suspense fallback={<HeadingSkeleton />}>
          <Greeting params={params} />
        </Suspense>
      }
    />
  );
}
