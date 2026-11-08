import type { Metadata } from "next";
import { Suspense } from "react";
import { IssueView, IssueViewSkeleton } from "@/features/issues/server";

type Props = PageProps<"/[workspace]/issues/[issueKey]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { issueKey } = await params;
  return { title: issueKey.toUpperCase() };
}

async function Issue({ params }: { params: Props["params"] }) {
  const { workspace, issueKey } = await params;
  return <IssueView slug={workspace} issueKey={issueKey} />;
}

export default function IssuePage({ params }: Props) {
  return (
    <Suspense fallback={<IssueViewSkeleton />}>
      <Issue params={params} />
    </Suspense>
  );
}
