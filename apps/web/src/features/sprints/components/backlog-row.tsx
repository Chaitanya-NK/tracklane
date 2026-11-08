"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PlanningCard } from "@/features/board";
import { IssueTypeIcon, LabelBadge, PriorityIcon, StatusBadge } from "@/features/issues";
import { cn } from "@/lib/utils";

/** One backlog line. Drag by the handle; the summary opens the quick view. */
export function BacklogRow({
  card,
  slug,
  dragging,
  overlay,
  handleProps,
  actions,
}: {
  card: PlanningCard;
  slug: string;
  dragging?: boolean;
  overlay?: boolean;
  handleProps?: React.HTMLAttributes<HTMLButtonElement> & { disabled?: boolean };
  /** Extra controls at the end of the row. */
  actions?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b bg-background px-2 py-1.5 text-sm last:border-b-0",
        dragging && "opacity-40",
        overlay && "rounded-md border shadow-lg",
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={`Move ${card.key}`}
        className="cursor-grab touch-none text-muted-foreground disabled:cursor-default"
        {...handleProps}
      >
        <GripVerticalIcon aria-hidden="true" />
      </Button>
      <IssueTypeIcon type={card.type} />
      <Link
        href={`/${slug}/issues/${card.key}` as Route}
        className="w-16 shrink-0 font-mono text-xs text-muted-foreground hover:underline"
      >
        {card.key}
      </Link>
      <Link
        href={`/${slug}/issues/${card.key}` as Route}
        className={cn(
          "min-w-0 flex-1 truncate hover:underline",
          card.status.category === "done" && "text-muted-foreground line-through",
        )}
      >
        {card.title}
      </Link>
      <span className="hidden shrink-0 items-center gap-1 lg:flex">
        {card.parent ? (
          <Badge
            variant="outline"
            className="h-5 max-w-40 truncate rounded px-1.5 text-violet-700 dark:text-violet-300"
          >
            {card.parent.title}
          </Badge>
        ) : null}
        {card.labels.slice(0, 2).map((label) => (
          <LabelBadge key={label.id} label={label} />
        ))}
      </span>
      <StatusBadge status={card.status} className="hidden sm:inline-flex" />
      <PriorityIcon priority={card.priority} />
      <Badge
        variant="secondary"
        className="h-5 min-w-7 justify-center rounded-full px-1.5 tabular-nums"
      >
        {card.estimate ?? "–"}
      </Badge>
      {card.assignee ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <UserAvatar user={card.assignee} />
            </span>
          </TooltipTrigger>
          <TooltipContent>{card.assignee.name}</TooltipContent>
        </Tooltip>
      ) : (
        <span className="size-6" aria-hidden="true" />
      )}
      {actions}
    </div>
  );
}

export function SortableBacklogRow({
  card,
  slug,
  disabled,
  actions,
}: {
  card: PlanningCard;
  slug: string;
  disabled?: boolean;
  actions?: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    disabled,
  });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <BacklogRow
        card={card}
        slug={slug}
        dragging={isDragging}
        actions={actions}
        handleProps={
          {
            ...attributes,
            ...listeners,
            disabled,
            ref: setActivatorNodeRef,
          } as React.HTMLAttributes<HTMLButtonElement>
        }
      />
    </div>
  );
}
