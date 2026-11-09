import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/shared/skeletons";
import { Inbox } from "@/features/notifications";
import { listNotifications, unreadCount } from "@/features/notifications/server";
import { getWorkspaceAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Inbox" };

type Props = PageProps<"/[workspace]/inbox">;

async function InboxContent({ params, searchParams }: Props) {
  const [{ workspace: slug }, sp] = await Promise.all([params, searchParams]);
  const view = sp.view === "all" ? "all" : "unread";
  const { user, workspace } = await getWorkspaceAccess(slug);
  const [items, unread] = await Promise.all([
    listNotifications({
      userId: user.id,
      workspaceId: workspace.id,
      unreadOnly: view === "unread",
    }),
    unreadCount(user.id, workspace.id),
  ]);
  return (
    <Inbox
      slug={workspace.slug}
      view={view}
      unread={unread}
      items={items.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        url: n.url,
        read: n.readAt !== null,
        createdAt: n.createdAt,
        actor: n.actor,
      }))}
    />
  );
}

export default function InboxPage(props: Props) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Inbox"
        description="Updates on work assigned to you, issues you watch and mentions."
      />
      <Suspense fallback={<TableSkeleton />}>
        <InboxContent {...props} />
      </Suspense>
    </div>
  );
}
