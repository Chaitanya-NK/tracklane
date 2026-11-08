import { Suspense } from "react";
import {
  IssueQuickViewHeader,
  IssueQuickViewHeaderFallback,
  IssueQuickViewSheet,
} from "@/features/issues";
import { IssueView, IssueViewSkeleton } from "@/features/issues/server";

/** Typed by hand: generated route types do not cover intercepting segments. */
type Props = { params: Promise<{ workspace: string; projectKey: string; issueKey: string }> };

async function Header({ params }: Props) {
  const { workspace, issueKey } = await params;
  return <IssueQuickViewHeader workspace={workspace} issueKey={issueKey} />;
}

async function Body({ params }: Props) {
  const { workspace, issueKey } = await params;
  return <IssueView slug={workspace} issueKey={issueKey} variant="sheet" />;
}

/**
 * Intercepts /<workspace>/issues/<KEY> when an issue is opened from a project page (board,
 * backlog, issue list) and shows it in a sheet over that page. Reloading shows the full page.
 */
export default function IssueQuickViewPage({ params }: Props) {
  return (
    <IssueQuickViewSheet
      header={
        <Suspense fallback={<IssueQuickViewHeaderFallback />}>
          <Header params={params} />
        </Suspense>
      }
    >
      <Suspense fallback={<IssueViewSkeleton />}>
        <Body params={params} />
      </Suspense>
    </IssueQuickViewSheet>
  );
}
