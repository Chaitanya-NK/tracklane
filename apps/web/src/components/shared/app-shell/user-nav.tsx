import { UserIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

/** Signed-in user menu. Phase 1 wires this to the session (profile, preferences, sign out). */
export function UserNav() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg">
          <Avatar className="size-8">
            <AvatarFallback>
              <UserIcon className="size-4" aria-hidden="true" />
            </AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">Guest</span>
            <span className="truncate text-xs text-muted-foreground">
              Sign-in arrives in Phase 1
            </span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
