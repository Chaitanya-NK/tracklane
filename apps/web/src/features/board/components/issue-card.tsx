"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Route } from "next";
import Link from "next/link";
import { type MouseEvent, useEffect, useRef } from "react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { IssueTypeIcon, LabelBadge, PriorityIcon } from "@/features/issues";
import { cn } from "@/lib/utils";
import type { PlanningCard } from "../types";

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
      {card.labels.length || card.parent ? (
        <div className="flex flex-wrap gap-1">
          {card.parent ? (
            <Badge
              variant="outline"
              className="h-5 max-w-full truncate rounded px-1.5 text-violet-700 dark:text-violet-300"
            >
              {card.parent.title}
            </Badge>
          ) : null}
          {card.labels.slice(0, 3).map((label) => (
            <LabelBadge key={label.id} label={label} />
          ))}
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <IssueTypeIcon type={card.type} />
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
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
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
  );
}
