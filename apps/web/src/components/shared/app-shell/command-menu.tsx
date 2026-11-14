"use client";

import {
  ArrowRightLeftIcon,
  KeyboardIcon,
  LinkIcon,
  MoonIcon,
  PlusIcon,
  SearchIcon,
  SunIcon,
  UserRoundCheckIcon,
} from "lucide-react";
import type { Route } from "next";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { collaborateNav, primaryNav, secondaryNav, workspacePath } from "@/config/navigation";
import { IssueTypeIcon, StatusBadge, useCreateIssue } from "@/features/issues";
import {
  bulkUpdateAction,
  issueContextAction,
  quickSearchAction,
} from "@/features/search/server/actions";
import { isBareShortcut } from "@/lib/keyboard";
import type { IssueType, StatusCategory } from "@tracklane/core";

/** "G then …" navigation. Project chords only work inside a project. */
const CHORDS: { key: string; label: string; segment?: string; project?: string }[] = [
  { key: "h", label: "For you", segment: "" },
  { key: "i", label: "Inbox", segment: "inbox" },
  { key: "p", label: "Projects", segment: "projects" },
  { key: "f", label: "Filters", segment: "filters" },
  { key: "d", label: "Dashboards", segment: "dashboards" },
  { key: "t", label: "Team", segment: "teams" },
  { key: "u", label: "Your profile", segment: "profile" },
  { key: "b", label: "Board (in a project)", project: "board" },
  { key: "l", label: "Backlog (in a project)", project: "backlog" },
  { key: "r", label: "Reports (in a project)", project: "reports" },
];

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["⌘", "K"], label: "Open the command menu" },
  { keys: ["C"], label: "Create an issue" },
  { keys: ["?"], label: "Show keyboard shortcuts" },
  { keys: ["M"], label: "Comment on the open issue" },
  { keys: ["⌘", "↵"], label: "Run a TQL query / send a comment" },
  ...CHORDS.map((c) => ({ keys: ["G", c.key.toUpperCase()], label: `Go to ${c.label}` })),
];

type QuickIssue = {
  id: string;
  key: string;
  title: string;
  type: string;
  status: { name: string; category: string };
};

function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Letter shortcuts work anywhere outside a text field.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[1fr_auto]">
          {SHORTCUTS.map((s) => (
            <div key={s.label} className="contents">
              <dt className="text-muted-foreground">{s.label}</dt>
              <dd>
                <KbdGroup>
                  {s.keys.map((k, i) => (
                    <Kbd key={i}>{k}</Kbd>
                  ))}
                </KbdGroup>
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}

/**
 * ⌘K / Ctrl+K command palette: issue search, actions on the open issue, navigation and
 * preferences. Also owns the global "G then…" chords and the "?" shortcut sheet.
 */
export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const { workspace, projectKey, issueKey } = useParams<{
    workspace: string;
    projectKey?: string;
    issueKey?: string;
  }>();
  const { openCreateIssue } = useCreateIssue();
  const { setTheme } = useTheme();
  const search = useAction(quickSearchAction);
  const context = useAction(issueContextAction);
  const update = useAction(bulkUpdateAction);
  const chord = useRef<number | null>(null);

  // The issue being viewed, from the URL (issue page or project quick view).
  const viewedKey = issueKey ?? pathname.match(/\/issues\/([A-Za-z][A-Za-z0-9]*-\d+)/)?.[1];

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }
      if (!isBareShortcut(event)) return;
      if (event.key === "?") {
        event.preventDefault();
        setHelp(true);
        return;
      }
      const key = event.key.toLowerCase();
      if (chord.current !== null && Date.now() - chord.current < 1200) {
        chord.current = null;
        const target = CHORDS.find((c) => c.key === key);
        if (!target) return;
        event.preventDefault();
        if (target.segment !== undefined) router.push(workspacePath(workspace, target.segment));
        else if (projectKey)
          router.push(`/${workspace}/projects/${projectKey}/${target.project}` as Route);
        return;
      }
      if (key === "g" && !event.shiftKey) chord.current = Date.now();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [router, workspace, projectKey]);

  // Search issues as the user types (debounced).
  const { execute: runSearch } = search;
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) return;
    const timer = setTimeout(async () => {
      runSearch({ slug: workspace, q });
    }, 180);
    return () => clearTimeout(timer);
  }, [query, open, workspace, runSearch]);
  const issues: QuickIssue[] = query.trim().length >= 2 ? (search.result.data ?? []) : [];

  // Load the viewed issue when the palette opens.
  const { execute: loadContext } = context;
  useEffect(() => {
    if (open && viewedKey) loadContext({ slug: workspace, issueKey: viewedKey });
  }, [open, viewedKey, workspace, loadContext]);
  const current = open && viewedKey ? (context.result.data ?? null) : null;

  const run = useCallback((action: () => void) => {
    setOpen(false);
    setQuery("");
    action();
  }, []);

  async function patch(p: { assigneeId?: string; statusName?: string }, done: string) {
    if (!current) return;
    const res = await update.executeAsync({ slug: workspace, issueIds: [current.id], patch: p });
    if (res?.serverError) toast.error(res.serverError.message);
    else if (res?.data?.awaitingApproval) toast.info("Sent for approval");
    else if (res?.data?.skipped.length) toast.warning(res.data.skipped[0]!.reason);
    else toast.success(done);
  }

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
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
        title="Command menu"
        description="Search issues or run a command"
      >
        <CommandInput
          placeholder="Search issues or run a command…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {search.isPending ? (
              <span className="inline-flex items-center gap-2">
                <Spinner /> Searching…
              </span>
            ) : (
              "No results found."
            )}
          </CommandEmpty>
          {issues.length ? (
            <CommandGroup heading="Issues">
              {issues.map((issue) => (
                <CommandItem
                  key={issue.id}
                  value={`${issue.key} ${issue.title}`}
                  onSelect={() =>
                    run(() => router.push(`/${workspace}/issues/${issue.key}` as Route))
                  }
                >
                  <IssueTypeIcon type={issue.type as IssueType} />
                  <span className="font-mono text-xs text-muted-foreground">{issue.key}</span>
                  <span className="min-w-0 flex-1 truncate">{issue.title}</span>
                  <StatusBadge
                    status={{
                      name: issue.status.name,
                      category: issue.status.category as StatusCategory,
                    }}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          {query.trim().length >= 2 ? (
            <CommandGroup heading="Search">
              <CommandItem
                value={`search everywhere ${query}`}
                onSelect={() =>
                  run(() =>
                    router.push(
                      `/${workspace}/filters?${new URLSearchParams({
                        q: `text ~ "${query.trim().replace(/"/g, '\\"')}"`,
                      })}` as Route,
                    ),
                  )
                }
              >
                <SearchIcon aria-hidden="true" />
                Search all issues for &ldquo;{query.trim()}&rdquo;
              </CommandItem>
            </CommandGroup>
          ) : null}
          {current ? (
            <>
              <CommandSeparator />
              <CommandGroup heading={current.key}>
                <CommandItem
                  onSelect={() =>
                    run(async () => {
                      try {
                        await navigator.clipboard.writeText(
                          `${window.location.origin}/${workspace}/issues/${current.key}`,
                        );
                        toast.success("Link copied");
                      } catch {
                        toast.error("Couldn't copy the link");
                      }
                    })
                  }
                >
                  <LinkIcon aria-hidden="true" />
                  Copy link
                </CommandItem>
                <CommandItem
                  onSelect={() =>
                    run(() =>
                      patch({ assigneeId: current.userId }, `${current.key} assigned to you`),
                    )
                  }
                >
                  <UserRoundCheckIcon aria-hidden="true" />
                  Assign to me
                </CommandItem>
                {current.statuses
                  .filter((s) => s.name !== current.status)
                  .map((s) => (
                    <CommandItem
                      key={s.name}
                      value={`move to ${s.name}`}
                      onSelect={() =>
                        run(() =>
                          patch({ statusName: s.name }, `${current.key} moved to ${s.name}`),
                        )
                      }
                    >
                      <ArrowRightLeftIcon aria-hidden="true" />
                      Move to {s.name}
                    </CommandItem>
                  ))}
              </CommandGroup>
            </>
          ) : null}
          <CommandSeparator />
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => run(() => openCreateIssue())}>
              <PlusIcon aria-hidden="true" />
              Create issue
              <Kbd className="ml-auto">C</Kbd>
            </CommandItem>
            <CommandItem onSelect={() => run(() => setHelp(true))}>
              <KeyboardIcon aria-hidden="true" />
              Keyboard shortcuts
              <Kbd className="ml-auto">?</Kbd>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Navigate">
            {[...primaryNav, ...collaborateNav, ...secondaryNav].map((item) => {
              const chordKey = CHORDS.find((c) => c.segment === item.segment)?.key;
              return (
                <CommandItem
                  key={item.segment}
                  onSelect={() => run(() => router.push(workspacePath(workspace, item.segment)))}
                >
                  <item.icon aria-hidden="true" />
                  {item.title}
                  {chordKey ? (
                    <KbdGroup className="ml-auto">
                      <Kbd>G</Kbd>
                      <Kbd>{chordKey.toUpperCase()}</Kbd>
                    </KbdGroup>
                  ) : null}
                </CommandItem>
              );
            })}
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
      <ShortcutsDialog open={help} onOpenChange={setHelp} />
    </>
  );
}
