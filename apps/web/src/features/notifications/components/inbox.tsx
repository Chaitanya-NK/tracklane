"use client";

import { isToday, isYesterday } from "date-fns";
import { BellIcon, CheckCheckIcon, CircleIcon, MailOpenIcon, Settings2Icon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { TimeAgo } from "@/components/shared/time-ago";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/shared/markdown";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/features/issues";
import { addCommentAction } from "@/features/issues/server/actions";
import { markReadAction, markUnreadAction } from "../server/actions";

export interface InboxRow {
  id: string;
  issueId: string | null;
  title: string;
  body: string;
  url: string;
  read: boolean;
  createdAt: Date;
  actor: { id: string; name: string; image: string | null } | null;
}

function dayLabel(date: Date) {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return "Earlier";
}

export interface InboxPreviewData {
  id: string;
  key: string;
  title: string;
  description: string;
  status: { name: string; category: "todo" | "in_progress" | "done" };
  project: { name: string };
  assignee: { name: string; image: string | null } | null;
  comments: {
    id: string;
    body: string;
    createdAt: Date;
    author: { name: string; image: string | null } | null;
  }[];
}

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "mentions", label: "Mentions" },
  { id: "assigned", label: "Assigned" },
  { id: "watching", label: "Watching" },
] as const;
type Category = (typeof CATEGORIES)[number]["id"];

function QuickReply({ issueId }: { issueId: string }) {
  const [body, setBody] = useState("");
  const add = useAction(addCommentAction, {
    onSuccess: () => {
      setBody("");
      toast.success("Reply posted");
    },
    onError: ({ error }) => toast.error(error.serverError?.message ?? "Couldn't reply"),
  });
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (body.trim()) add.execute({ issueId, body });
      }}
    >
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (body.trim()) add.execute({ issueId, body });
          }
        }}
        rows={3}
        placeholder="Quick reply… (Ctrl+Enter to send)"
        aria-label="Quick reply"
        maxLength={10000}
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={add.isPending || !body.trim()}>
          Reply
        </Button>
      </div>
    </form>
  );
}

function Preview({ slug, preview }: { slug: string; preview: InboxPreviewData }) {
  return (
    <aside
      aria-label={`Preview of ${preview.key}`}
      className="space-y-4 rounded-lg border p-4 lg:sticky lg:top-4"
    >
      <div className="space-y-1">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">{preview.key}</span> · {preview.project.name}
          <StatusBadge status={preview.status} className="ml-auto" />
        </p>
        <h2 className="text-lg font-semibold">{preview.title}</h2>
        {preview.assignee ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <UserAvatar user={preview.assignee} className="size-5" /> {preview.assignee.name}
          </p>
        ) : null}
      </div>
      {preview.description ? (
        <div className="max-h-40 overflow-y-auto text-sm">
          <Markdown>{preview.description}</Markdown>
        </div>
      ) : null}
      {preview.comments.length ? (
        <ol className="space-y-3 border-t pt-3">
          {preview.comments.map((c) => (
            <li key={c.id} className="flex gap-2 text-sm">
              <UserAvatar user={c.author ?? { name: "?" }} className="mt-0.5 size-6" />
              <div className="min-w-0 flex-1">
                <p className="text-xs">
                  <span className="font-medium">{c.author?.name ?? "Former member"}</span>{" "}
                  <TimeAgo date={c.createdAt} className="text-muted-foreground" />
                </p>
                <div className="line-clamp-4">
                  <Markdown>{c.body}</Markdown>
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
      <QuickReply issueId={preview.id} />
      <Button asChild variant="outline" size="sm" className="w-full">
        <Link href={`/${slug}/issues/${preview.key}` as Route}>Open issue</Link>
      </Button>
    </aside>
  );
}

export function Inbox({
  slug,
  items,
  view,
  unread,
  category = "all",
  selectedId = null,
  preview = null,
}: {
  slug: string;
  items: InboxRow[];
  view: "unread" | "all";
  unread: number;
  category?: Category;
  selectedId?: string | null;
  preview?: InboxPreviewData | null;
}) {
  const router = useRouter();
  const read = useAction(markReadAction);
  const unreadAction = useAction(markUnreadAction);

  async function markAll() {
    const res = await read.executeAsync({ slug });
    if (res?.serverError) toast.error(res.serverError.message);
    else toast.success(`Marked ${res?.data?.count ?? 0} as read`);
  }

  const href = (patch: { view?: string; category?: string; n?: string | null }) => {
    const params = new URLSearchParams();
    const v = patch.view ?? view;
    const c = patch.category ?? category;
    const n = patch.n === undefined ? selectedId : patch.n;
    if (v === "all") params.set("view", "all");
    if (c !== "all") params.set("category", c);
    if (n) params.set("n", n);
    const q = params.toString();
    return `/${slug}/inbox${q ? `?${q}` : ""}` as Route;
  };

  function open(item: InboxRow) {
    if (!item.read) void read.executeAsync({ slug, ids: [item.id] });
    // Issue notifications open in the preview pane; others go straight to their page.
    if (item.issueId) router.replace(href({ n: item.id }), { scroll: false });
    else router.push(item.url as Route);
  }

  const groups = new Map<string, InboxRow[]>();
  for (const item of items) {
    const label = dayLabel(item.createdAt);
    groups.set(label, [...(groups.get(label) ?? []), item]);
  }

  return (
    <div className="space-y-4">
      <Tabs value={category}>
        <TabsList aria-label="Category">
          {CATEGORIES.map((c) => (
            <TabsTrigger key={c.id} value={c.id} asChild>
              <Link href={href({ category: c.id, n: null })}>{c.label}</Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className={cn("grid gap-4", preview && "lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]")}>
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={view}
              onValueChange={(v) => v && router.replace(href({ view: v, n: null }))}
              aria-label="Show"
            >
              <ToggleGroupItem value="unread">Unread{unread ? ` (${unread})` : ""}</ToggleGroupItem>
              <ToggleGroupItem value="all">All</ToggleGroupItem>
            </ToggleGroup>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={markAll}
                disabled={!unread || read.isPending}
              >
                <CheckCheckIcon />
                Mark all as read
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/${slug}/settings/notifications` as Route}>
                  <Settings2Icon />
                  Preferences
                </Link>
              </Button>
            </div>
          </div>

          {items.length === 0 ? (
            <EmptyState
              icon={BellIcon}
              title={view === "unread" ? "You're all caught up" : "No notifications yet"}
              description="Assignments, mentions, comments on issues you watch and approval requests show up here."
            />
          ) : (
            [...groups.entries()].map(([label, rows]) => (
              <section key={label} aria-label={label} className="space-y-1">
                <h2 className="px-1 text-xs font-medium text-muted-foreground">{label}</h2>
                <ul className="divide-y rounded-lg border">
                  {rows.map((item) => (
                    <li
                      key={item.id}
                      className={cn(
                        "group flex items-start gap-3 p-3",
                        !item.read && "bg-primary/[0.03]",
                        item.id === selectedId && "bg-muted",
                      )}
                    >
                      <span className="mt-2 flex w-2 justify-center" aria-hidden="true">
                        {!item.read ? (
                          <CircleIcon className="size-2 fill-primary text-primary" />
                        ) : null}
                      </span>
                      <UserAvatar
                        user={item.actor ?? { name: "?", image: null }}
                        className="size-7"
                      />
                      <button
                        type="button"
                        onClick={() => open(item)}
                        className="min-w-0 flex-1 text-left outline-none focus-visible:underline"
                      >
                        <span className={cn("block text-sm", !item.read && "font-medium")}>
                          {item.title}
                          <span className="sr-only">{item.read ? "" : " (unread)"}</span>
                        </span>
                        {item.body ? (
                          <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">
                            {item.body}
                          </span>
                        ) : null}
                        <span className="mt-1 block text-xs text-muted-foreground">
                          <TimeAgo date={item.createdAt} />
                        </span>
                      </button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                            aria-label={item.read ? "Mark as unread" : "Mark as read"}
                            onClick={() =>
                              item.read
                                ? void unreadAction.executeAsync({ id: item.id })
                                : void read.executeAsync({ slug, ids: [item.id] })
                            }
                          >
                            {item.read ? <CircleIcon /> : <MailOpenIcon />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {item.read ? "Mark as unread" : "Mark as read"}
                        </TooltipContent>
                      </Tooltip>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
        {preview ? <Preview slug={slug} preview={preview} /> : null}
      </div>
    </div>
  );
}
