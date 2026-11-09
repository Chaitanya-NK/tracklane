import { SidebarMenuBadge } from "@/components/ui/sidebar";
import { getWorkspaceAccess } from "@/server/authz";
import { unreadCount } from "../server/queries";

/** Unread count next to "Inbox" in the sidebar. */
export async function InboxBadge({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params;
  const { user, workspace } = await getWorkspaceAccess(slug);
  const count = await unreadCount(user.id, workspace.id);
  if (!count) return null;
  return (
    <SidebarMenuBadge
      aria-label={`${count} unread`}
      className="rounded-full bg-primary px-1.5 text-primary-foreground"
    >
      {count > 99 ? "99+" : count}
    </SidebarMenuBadge>
  );
}
