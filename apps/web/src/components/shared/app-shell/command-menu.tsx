"use client";

import { MoonIcon, PlusIcon, SearchIcon, SunIcon } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { primaryNav, secondaryNav, workspacePath } from "@/config/navigation";
import { useCreateIssue } from "@/features/issues";

/** ⌘K / Ctrl+K command palette. Issues, actions and AI search plug into this in later phases. */
export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { workspace } = useParams<{ workspace: string }>();
  const { openCreateIssue } = useCreateIssue();
  const { setTheme } = useTheme();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const run = useCallback((action: () => void) => {
    setOpen(false);
    action();
  }, []);

  return (
    <>
      <SidebarMenuButton
        onClick={() => setOpen(true)}
        className="border border-sidebar-border bg-background text-muted-foreground shadow-xs"
        tooltip="Search (⌘K)"
      >
        <SearchIcon aria-hidden="true" />
        <span>Search…</span>
        <Kbd className="ml-auto">⌘K</Kbd>
      </SidebarMenuButton>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Command menu"
        description="Search or run a command"
      >
        <CommandInput placeholder="Search or run a command…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => run(() => openCreateIssue())}>
              <PlusIcon aria-hidden="true" />
              Create issue
              <Kbd className="ml-auto">C</Kbd>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Navigate">
            {[...primaryNav, ...secondaryNav].map((item) => (
              <CommandItem
                key={item.segment}
                onSelect={() => run(() => router.push(workspacePath(workspace, item.segment)))}
              >
                <item.icon aria-hidden="true" />
                {item.title}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Preferences">
            <CommandItem onSelect={() => run(() => setTheme("light"))}>
              <SunIcon aria-hidden="true" />
              Light theme
            </CommandItem>
            <CommandItem onSelect={() => run(() => setTheme("dark"))}>
              <MoonIcon aria-hidden="true" />
              Dark theme
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
