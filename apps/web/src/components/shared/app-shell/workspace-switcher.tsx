import { ChevronsUpDownIcon } from "lucide-react";
import { BrandMark } from "@/components/shared/brand-mark";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

/** Workspace picker. Phase 1 replaces the static label with the signed-in user's workspaces. */
export function WorkspaceSwitcher() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
          <BrandMark />
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">Tracklane</span>
            <span className="truncate text-xs text-muted-foreground">Local workspace</span>
          </div>
          <ChevronsUpDownIcon className="ml-auto size-4" aria-hidden="true" />
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
