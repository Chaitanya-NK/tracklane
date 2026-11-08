"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { BoardColumn as Column, PlanningCard } from "../types";
import { SortableIssueCard } from "./issue-card";

const CATEGORY_DOT = {
  todo: "bg-muted-foreground/50",
  in_progress: "bg-status-in-progress",
  done: "bg-status-done",
} as const;

export function BoardColumn({
  column,
  cards,
  slug,
  canEdit,
}: {
  column: Column;
  cards: PlanningCard[];
  slug: string;
  canEdit: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id, data: { type: "column" } });
  const points = cards.reduce((sum, c) => sum + (c.estimate ?? 0), 0);

  return (
    <section
      aria-label={column.name}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-xl border bg-muted/50 transition-colors",
        isOver && "border-primary/40 bg-primary/5",
      )}
    >
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span
          className={cn("size-2 rounded-full", CATEGORY_DOT[column.category])}
          aria-hidden="true"
        />
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {column.name}
        </h2>
        <Badge variant="secondary" className="h-5 rounded-full px-1.5 tabular-nums">
          {cards.length}
        </Badge>
        {points ? (
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">{points} pts</span>
        ) : null}
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div ref={setNodeRef} className="flex min-h-24 flex-col gap-2 px-2 pb-3">
            {cards.map((card) => (
              <SortableIssueCard key={card.id} card={card} slug={slug} disabled={!canEdit} />
            ))}
            {cards.length === 0 ? (
              <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                {canEdit ? "Drop issues here" : "No issues"}
              </p>
            ) : null}
          </div>
        </SortableContext>
      </ScrollArea>
    </section>
  );
}
