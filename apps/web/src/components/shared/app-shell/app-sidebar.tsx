import { PlusIcon } from "lucide-react";
import { Suspense } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarRail,
} from "@/components/ui/sidebar";
import { CommandMenu } from "./command-menu";
import { NavMain } from "./nav-main";
import { UserNav } from "./user-nav";
import { WorkspaceSwitcher } from "./workspace-switcher";

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <WorkspaceSwitcher />
        <SidebarMenu>
          <SidebarMenuItem className="flex gap-1.5">
            <CommandMenu />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Create issue" disabled>
              <PlusIcon aria-hidden="true" />
              <span>Create issue</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {/* The active-link highlight reads the URL, so it streams in after the static shell. */}
        <Suspense
          fallback={
            <SidebarGroup>
              {Array.from({ length: 7 }, (_, i) => (
                <SidebarMenuSkeleton key={i} showIcon width={`${55 + ((i * 13) % 35)}%`} />
              ))}
            </SidebarGroup>
          }
        >
          <NavMain />
        </Suspense>
      </SidebarContent>
      <SidebarFooter>
        <UserNav />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
