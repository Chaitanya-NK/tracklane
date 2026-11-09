"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BlockedBadge, EpicChip, type PlanningCard } from "@/features/board";
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
  selection,
}: {
  card: PlanningCard;
  slug: string;
  dragging?: boolean;
  overlay?: boolean;
  /** Bulk-selection checkbox state. */
  selection?: { checked: boolean; onChange: (checked: boolean) => void };
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
        selection?.checked && "bg-primary/5",
      )}
    >
      {selection ? (
        <Checkbox
          aria-label={`Select ${card.key}`}
          checked={selection.checked}
          onCheckedChange={(on) => selection.onChange(on === true)}
          className="ml-1"
        />
      ) : null}
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
      <IssueTypeIcon type={card.type} custom={card.customType} />
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
      {card.blockedBy.length ? <BlockedBadge blockedBy={card.blockedBy} /> : null}
      <span className="hidden shrink-0 items-center gap-1 lg:flex">
        {card.parent ? <EpicChip parent={card.parent} className="max-w-40" /> : null}
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
  selection,
}: {
  card: PlanningCard;
  slug: string;
  disabled?: boolean;
  actions?: React.ReactNode;
  selection?: { checked: boolean; onChange: (checked: boolean) => void };
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
        selection={selection}
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
