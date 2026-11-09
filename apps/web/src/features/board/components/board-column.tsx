"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createIssueAction } from "@/features/issues/server/actions";
import { setWipLimitAction } from "@/features/workflow/server/actions";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { BoardColumn as Column, PlanningCard } from "../types";
import { SortableIssueCard } from "./issue-card";

const CATEGORY_DOT = {
  todo: "bg-muted-foreground/50",
  in_progress: "bg-status-in-progress",
  done: "bg-status-done",
} as const;

/** Context for column actions (WIP limits, inline create). */
export interface ColumnContext {
  slug: string;
  projectKey: string;
  sprintId: string | null;
  canManage: boolean;
  canCreate: boolean;
}

function WipMenu({ column, ctx }: { column: Column; ctx: ColumnContext }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(column.wipLimit ? String(column.wipLimit) : "");
  const action = useAction(setWipLimitAction, {
    onSuccess: ({ input }) => {
      setOpen(false);
      toast.success(input.limit ? `WIP limit set to ${input.limit}` : "WIP limit removed");
    },
    onError: ({ error }) => toast.error(error.serverError?.message ?? "Couldn't set the limit"),
  });
  const set = (limit: number | null) =>
    action.execute({ slug: ctx.slug, projectKey: ctx.projectKey, statusId: column.id, limit });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="size-6 text-muted-foreground">
          <MoreHorizontalIcon aria-hidden="true" />
          <span className="sr-only">{column.name} options</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number.parseInt(value, 10);
            set(value.trim() === "" || !Number.isFinite(n) || n < 1 ? null : Math.min(n, 999));
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor={`wip-${column.id}`}>WIP limit</Label>
            <Input
              id={`wip-${column.id}`}
              type="number"
              min={1}
              max={999}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="No limit"
              className="h-8"
            />
            <p className="text-xs text-muted-foreground">
              The column turns red when it holds more issues than this.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            {column.wipLimit ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => set(null)}>
                Remove
              </Button>
            ) : null}
            <Button type="submit" size="sm" disabled={action.isPending}>
              Save
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function InlineCreate({ column, ctx }: { column: Column; ctx: ColumnContext }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const create = useAction(createIssueAction, {
    onSuccess: ({ data }) => {
      setTitle("");
      toast.success(`Created ${data.key}`);
    },
    onError: ({ error }) =>
      toast.error(error.serverError?.message ?? "Couldn't create the issue — use the full form"),
  });
  if (!open)
    return (
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <PlusIcon aria-hidden="true" /> Create issue
      </Button>
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        create.execute({
          slug: ctx.slug,
          projectKey: ctx.projectKey,
          type: "task",
          customTypeId: null,
          title: title.trim(),
          description: "",
          priority: "medium",
          statusId: column.id,
          assigneeId: null,
          parentId: null,
          labelIds: [],
          sprintId: ctx.sprintId,
          startDate: null,
          dueDate: null,
          estimate: null,
          fieldValues: {},
        });
      }}
    >
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        onBlur={() => !title.trim() && setOpen(false)}
        placeholder="What needs doing? ↵ to add"
        aria-label={`New issue in ${column.name}`}
        disabled={create.isPending}
        className="h-8 bg-background"
        maxLength={255}
      />
    </form>
  );
}

export function ColumnHeader({
  column,
  count,
  points,
  ctx,
}: {
  column: Column;
  count: number;
  points?: number;
  ctx?: ColumnContext;
}) {
  const over = column.wipLimit ? count > column.wipLimit : false;
  return (
    <header className="flex items-center gap-2 px-3 pt-3 pb-2">
      <span
        className={cn("size-2 rounded-full", CATEGORY_DOT[column.category])}
        aria-hidden="true"
      />
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {column.name}
      </h2>
      <Badge
        variant={over ? "destructive" : "secondary"}
        className="h-5 rounded-full px-1.5 tabular-nums"
        title={column.wipLimit ? `WIP limit ${column.wipLimit}` : undefined}
      >
        {column.wipLimit ? `${count}/${column.wipLimit}` : count}
      </Badge>
      {over ? <span className="text-xs font-medium text-destructive">Over limit</span> : null}
      <span className="ml-auto flex items-center gap-1">
        {points ? (
          <span className="text-xs text-muted-foreground tabular-nums">{points} pts</span>
        ) : null}
        {ctx?.canManage ? <WipMenu column={column} ctx={ctx} /> : null}
      </span>
    </header>
  );
}

/**
 * A drop target of cards: a whole column, or (with swimlanes, `compact`) one lane's cell in it.
 * `blocked` dims it while dragging a card the workflow won't let in.
 */
export function BoardColumn({
  droppableId,
  column,
  cards,
  slug,
  canEdit,
  blocked = false,
  compact = false,
  ctx,
}: {
  droppableId: string;
  column: Column;
  cards: PlanningCard[];
  slug: string;
  canEdit: boolean;
  blocked?: boolean;
  compact?: boolean;
  ctx?: ColumnContext;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: { type: "column" },
    disabled: blocked,
  });
  const points = cards.reduce((sum, c) => sum + (c.estimate ?? 0), 0);
  const list = (
    <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
      <div
        ref={setNodeRef}
        className={cn("flex min-h-24 flex-col gap-2 px-2 pb-3", compact && "pt-2")}
      >
        {cards.map((card) => (
          <SortableIssueCard key={card.id} card={card} slug={slug} disabled={!canEdit} />
        ))}
        {cards.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
            {blocked ? "Not allowed by the workflow" : canEdit ? "Drop issues here" : "No issues"}
          </p>
        ) : null}
        {ctx?.canCreate && !compact ? <InlineCreate column={column} ctx={ctx} /> : null}
      </div>
    </SortableContext>
  );

  return (
    <section
      aria-label={compact ? undefined : column.name}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-xl border bg-muted/50 transition-[opacity,colors]",
        !compact &&
          column.wipLimit &&
          cards.length > column.wipLimit &&
          "border-destructive/50 bg-destructive/5",
        isOver && "border-primary/40 bg-primary/5",
        blocked && "opacity-40",
      )}
    >
      {compact ? (
        list
      ) : (
        <>
          <ColumnHeader column={column} count={cards.length} points={points} ctx={ctx} />
          {/* Radix wraps content in a display:table box that grows to fit the widest card;
              make it a block so long chips truncate inside the column. */}
          <ScrollArea className="min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]>div]:!block">
            {list}
          </ScrollArea>
        </>
      )}
    </section>
  );
}
