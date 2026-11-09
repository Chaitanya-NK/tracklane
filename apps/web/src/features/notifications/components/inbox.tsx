"use client";

import { isToday, isYesterday } from "date-fns";
import { BellIcon, CheckCheckIcon, CircleIcon, MailOpenIcon, Settings2Icon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { TimeAgo } from "@/components/shared/time-ago";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { markReadAction, markUnreadAction } from "../server/actions";

export interface InboxRow {
  id: string;
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

export function Inbox({
  slug,
  items,
  view,
  unread,
}: {
  slug: string;
  items: InboxRow[];
  view: "unread" | "all";
  unread: number;
}) {
  const router = useRouter();
  const read = useAction(markReadAction);
  const unreadAction = useAction(markUnreadAction);

  async function markAll() {
    const res = await read.executeAsync({ slug });
    if (res?.serverError) toast.error(res.serverError.message);
    else toast.success(`Marked ${res?.data?.count ?? 0} as read`);
  }

  function open(item: InboxRow) {
    if (!item.read) void read.executeAsync({ slug, ids: [item.id] });
    router.push(item.url as Route);
  }

  const groups = new Map<string, InboxRow[]>();
  for (const item of items) {
    const label = dayLabel(item.createdAt);
    groups.set(label, [...(groups.get(label) ?? []), item]);
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={view}
          onValueChange={(v) =>
            v && router.replace(`/${slug}/inbox${v === "all" ? "?view=all" : ""}` as Route)
          }
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
                  )}
                >
                  <span className="mt-2 flex w-2 justify-center" aria-hidden="true">
                    {!item.read ? (
                      <CircleIcon className="size-2 fill-primary text-primary" />
                    ) : null}
                  </span>
                  <UserAvatar user={item.actor ?? { name: "?", image: null }} className="size-7" />
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
                    <TooltipContent>{item.read ? "Mark as unread" : "Mark as read"}</TooltipContent>
                  </Tooltip>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
