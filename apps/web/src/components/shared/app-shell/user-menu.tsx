"use client";

import { ChevronsUpDownIcon, LogOutIcon, MoonIcon, SunIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { initials } from "@/lib/format";

interface UserMenuProps {
  user: { name: string; email: string; image: string | null };
}

function UserAvatar({ user }: UserMenuProps) {
  return (
    <Avatar className="size-8">
      {user.image ? <AvatarImage src={user.image} alt="" /> : null}
      <AvatarFallback>{initials(user.name || user.email)}</AvatarFallback>
    </Avatar>
  );
}

export function UserMenu({ user }: UserMenuProps) {
  const router = useRouter();
  const { isMobile } = useSidebar();
  const { resolvedTheme, setTheme } = useTheme();

  async function signOut() {
    const { error } = await authClient.signOut();
    if (error) {
      toast.error("Couldn't sign out. Try again.");
      return;
    }
    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
              <UserAvatar user={user} />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              </div>
              <ChevronsUpDownIcon className="ml-auto size-4" aria-hidden="true" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="flex items-center gap-2 font-normal">
              <UserAvatar user={user} />
              <div className="grid text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            >
              {resolvedTheme === "dark" ? (
                <SunIcon aria-hidden="true" />
              ) : (
                <MoonIcon aria-hidden="true" />
              )}
              {resolvedTheme === "dark" ? "Light theme" : "Dark theme"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={signOut}>
              <LogOutIcon aria-hidden="true" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
