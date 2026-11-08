import { Suspense } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarRail,
} from "@/components/ui/sidebar";
import { CommandMenu } from "./command-menu";
import { CreateIssueMenuButton } from "./create-issue-menu-button";
import { NavMain } from "./nav-main";
import { UserNav, UserNavFallback } from "./user-nav";
import { WorkspaceSwitcher, WorkspaceSwitcherFallback } from "./workspace-switcher";

export function AppSidebar({ params }: { params: Promise<{ workspace: string }> }) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Suspense fallback={<WorkspaceSwitcherFallback />}>
          <WorkspaceSwitcher params={params} />
        </Suspense>
        <SidebarMenu>
          <SidebarMenuItem className="flex gap-1.5">
            <Suspense fallback={<SidebarMenuSkeleton showIcon width="80%" />}>
              <CommandMenu />
            </Suspense>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <CreateIssueMenuButton />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {/* Links depend on the URL, so they stream in after the static shell. */}
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
        <Suspense fallback={<UserNavFallback />}>
          <UserNav />
        </Suspense>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
