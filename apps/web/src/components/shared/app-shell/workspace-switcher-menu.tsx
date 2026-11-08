"use client";

import { ROLE_LABELS, type WorkspaceRole } from "@tracklane/core";
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
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
import { workspacePath } from "@/config/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

interface WorkspaceOption {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
}

function WorkspaceAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <Avatar className={cn("size-8 rounded-lg", className)} aria-hidden="true">
      <AvatarFallback className="rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

export function WorkspaceSwitcherMenu({
  workspaces,
  currentSlug,
}: {
  workspaces: WorkspaceOption[];
  currentSlug: string;
}) {
  const { isMobile } = useSidebar();
  const current = workspaces.find((w) => w.slug === currentSlug);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
              <WorkspaceAvatar name={current?.name ?? currentSlug} />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{current?.name ?? currentSlug}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {current ? ROLE_LABELS[current.role] : "Workspace"}
                </span>
              </div>
              <ChevronsUpDownIcon className="ml-auto size-4" aria-hidden="true" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-60"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Workspaces
            </DropdownMenuLabel>
            {workspaces.map((workspace) => (
              <DropdownMenuItem key={workspace.id} asChild className="gap-2 p-2">
                <Link href={workspacePath(workspace.slug)}>
                  <WorkspaceAvatar
                    name={workspace.name}
                    className="size-6 rounded-md text-[10px] *:rounded-md"
                  />
                  <span className="flex-1 truncate">{workspace.name}</span>
                  {workspace.slug === currentSlug ? (
                    <CheckIcon className="size-4" aria-label="Current workspace" />
                  ) : null}
                </Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="gap-2 p-2">
              <Link href="/onboarding?new=1">
                <span className="flex size-6 items-center justify-center rounded-md border">
                  <PlusIcon className="size-4" aria-hidden="true" />
                </span>
                Create workspace
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
