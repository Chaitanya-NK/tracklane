"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FlagIcon, LinkIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { type MouseEvent, type ReactNode, useEffect, useRef } from "react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { IssueTypeIcon, LabelBadge, PriorityIcon } from "@/features/issues";
import { setIssueFlagAction } from "@/features/issues/server/actions";
import { cn } from "@/lib/utils";
import type { PlanningCard } from "../types";
import { BlockedBadge } from "./blocked-badge";
import { EpicChip } from "./epic-chip";

/** Board card content. The whole card links to the issue (opens the quick view). */
export function IssueCard({
  card,
  slug,
  dragging,
  overlay,
  onNavigate,
}: {
  card: PlanningCard;
  slug: string;
  dragging?: boolean;
  overlay?: boolean;
  onNavigate?: (event: MouseEvent) => void;
}) {
  return (
    <Card
      className={cn(
        "group relative gap-2 rounded-lg p-3 shadow-xs transition-shadow hover:shadow-md",
        card.flagged && "border-red-300 bg-red-50/60 dark:border-red-900 dark:bg-red-950/30",
        dragging && "opacity-40",
        overlay && "rotate-1 shadow-lg ring-2 ring-primary/30",
      )}
    >
      <p
        className={cn(
          "text-sm leading-snug font-medium",
          card.status.category === "done" && "text-muted-foreground",
        )}
      >
        <Link
          href={`/${slug}/issues/${card.key}` as Route}
          onClick={onNavigate}
          className="after:absolute after:inset-0 focus-visible:outline-none"
          draggable={false}
        >
          {card.title}
        </Link>
      </p>
      {card.labels.length || card.parent || card.blockedBy.length || card.flagged ? (
        <div className="flex min-w-0 flex-wrap gap-1">
          {card.flagged ? (
            <span className="inline-flex h-5 items-center gap-1 rounded-md bg-red-100 px-1.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
              <FlagIcon className="size-3 fill-current" aria-hidden="true" /> Flagged
            </span>
          ) : null}
          {card.blockedBy.length ? <BlockedBadge blockedBy={card.blockedBy} /> : null}
          {card.parent ? <EpicChip parent={card.parent} className="max-w-full" /> : null}
          {card.labels.slice(0, 3).map((label) => (
            <LabelBadge key={label.id} label={label} />
          ))}
        </div>
      ) : null}
      {card.subtasks ? (
        <div
          className="flex items-center gap-2"
          aria-label={`${card.subtasks.done} of ${card.subtasks.total} subtasks done`}
        >
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-status-done"
              style={{ width: `${(card.subtasks.done / card.subtasks.total) * 100}%` }}
            />
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {card.subtasks.done}/{card.subtasks.total}
          </span>
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <IssueTypeIcon type={card.type} custom={card.customType} />
        <span
          className={cn(
            "font-mono text-xs text-muted-foreground",
            card.status.category === "done" && "line-through",
          )}
        >
          {card.key}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <PriorityIcon priority={card.priority} />
          {card.estimate !== null ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="h-5 min-w-5 rounded-full px-1.5 tabular-nums">
                  {card.estimate}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Story points</TooltipContent>
            </Tooltip>
          ) : null}
          {card.assignee ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <UserAvatar user={card.assignee} />
                </span>
              </TooltipTrigger>
              <TooltipContent>{card.assignee.name}</TooltipContent>
            </Tooltip>
          ) : null}
        </span>
      </div>
    </Card>
  );
}

/** Right-click menu on a card: flag, copy link. */
function CardMenu({
  card,
  slug,
  canEdit,
  children,
}: {
  card: PlanningCard;
  slug: string;
  canEdit: boolean;
  children: ReactNode;
}) {
  const flag = useAction(setIssueFlagAction, {
    onSuccess: ({ input }) =>
      toast.success(input.flagged ? `${card.key} flagged` : `Flag removed from ${card.key}`),
    onError: ({ error }) => toast.error(error.serverError?.message ?? "Couldn't change the flag"),
  });
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        {canEdit ? (
          <ContextMenuItem
            onSelect={() => flag.execute({ issueId: card.id, flagged: !card.flagged })}
          >
            <FlagIcon aria-hidden="true" /> {card.flagged ? "Remove flag" : "Flag"}
          </ContextMenuItem>
        ) : null}
        <ContextMenuItem
          onSelect={async () => {
            try {
              await navigator.clipboard.writeText(
                `${window.location.origin}/${slug}/issues/${card.key}`,
              );
              toast.success("Link copied");
            } catch {
              toast.error("Couldn't copy the link");
            }
          }}
        >
          <LinkIcon aria-hidden="true" /> Copy link
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** Draggable card. A click that ends a drag doesn't navigate. */
export function SortableIssueCard({
  card,
  slug,
  disabled,
}: {
  card: PlanningCard;
  slug: string;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card" },
    disabled,
  });
  const dragged = useRef(false);
  useEffect(() => {
    if (isDragging) dragged.current = true;
  }, [isDragging]);

  return (
    <CardMenu card={card} slug={slug} canEdit={!disabled}>
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        {...attributes}
        {...listeners}
        // dnd-kit makes this a button, but it wraps the card's own link and menu buttons;
        // a group can hold interactive children and keyboard dragging still works on focus.
        role="group"
        aria-roledescription="Draggable issue"
        aria-label={`${card.key}: ${card.title}`}
        className="touch-none rounded-lg focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <IssueCard
          card={card}
          slug={slug}
          dragging={isDragging}
          onNavigate={(event) => {
            if (dragged.current) {
              event.preventDefault();
              dragged.current = false;
            }
          }}
        />
      </div>
    </CardMenu>
  );
}
