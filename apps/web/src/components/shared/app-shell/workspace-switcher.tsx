import { listUserWorkspaces } from "@/features/workspaces/server";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";
import { requireUser } from "@/server/auth";
import { WorkspaceSwitcherMenu } from "./workspace-switcher-menu";

/** Loads the user's workspaces for the switcher. Request-time data: render inside Suspense. */
export async function WorkspaceSwitcher({ params }: { params: Promise<{ workspace: string }> }) {
  const [{ workspace: slug }, user] = await Promise.all([params, requireUser()]);
  const workspaces = await listUserWorkspaces(user.id);
  return <WorkspaceSwitcherMenu workspaces={workspaces} currentSlug={slug} />;
}

export function WorkspaceSwitcherFallback() {
  return (
    <SidebarMenu>
      <SidebarMenuItem className="flex items-center gap-2 p-2">
        <Skeleton className="size-8 rounded-lg" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
