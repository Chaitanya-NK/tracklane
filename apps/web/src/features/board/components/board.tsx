"use client";

import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useAction } from "next-safe-action/hooks";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { moveIssueAction } from "@/features/issues/server/actions";
import { type Columns, findColumn, moveItem, neighboursOf } from "../columns";
import { type CardFilters, EMPTY_FILTERS, isFiltering, matchesFilters } from "../filters";
import type { BoardColumn as Column, PlanningCard } from "../types";
import { BoardColumn } from "./board-column";
import { CardFiltersBar } from "./card-filters-bar";
import { IssueCard } from "./issue-card";

function columnsFrom(columns: Column[], cards: PlanningCard[]): Columns {
  const result: Columns = Object.fromEntries(columns.map((c) => [c.id, [] as string[]]));
  for (const card of cards) result[card.statusId]?.push(card.id);
  return result;
}

/**
 * Drag cards between columns (changes status) and within a column (changes rank). The move shows
 * immediately and is rolled back if the server refuses it.
 */
export function Board({
  slug,
  columns,
  cards,
  canEdit,
  currentUserId,
}: {
  slug: string;
  columns: Column[];
  cards: PlanningCard[];
  canEdit: boolean;
  currentUserId: string;
}) {
  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const serverColumns = useMemo(() => columnsFrom(columns, cards), [columns, cards]);
  const [optimisticColumns, setOptimisticColumns] = useOptimistic(serverColumns);
  const [dragColumns, setDragColumns] = useState<Columns | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filters, setFilters] = useState<CardFilters>(EMPTY_FILTERS);
  const [, startTransition] = useTransition();
  const move = useAction(moveIssueAction);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const current = dragColumns ?? optimisticColumns;
  const people = useMemo(() => {
    const seen = new Map<string, NonNullable<PlanningCard["assignee"]>>();
    for (const card of cards) if (card.assignee) seen.set(card.assignee.id, card.assignee);
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [cards]);

  const visible = (ids: string[]) =>
    ids
      .map((id) => cardById.get(id))
      .filter(
        (card): card is PlanningCard =>
          Boolean(card) && matchesFilters(card!, filters, currentUserId),
      );

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
    setDragColumns(optimisticColumns);
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over || !dragColumns) return;
    const activeColumn = findColumn(dragColumns, String(active.id));
    const overColumn = findColumn(dragColumns, String(over.id));
    if (!activeColumn || !overColumn || activeColumn === overColumn) return;
    // Entering another column: insert at the hovered card's position (or the end).
    const overIndex = dragColumns[overColumn]!.indexOf(String(over.id));
    setDragColumns(
      moveItem(dragColumns, String(active.id), overColumn, overIndex < 0 ? undefined : overIndex),
    );
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const id = String(active.id);
    const working = dragColumns;
    setActiveId(null);
    setDragColumns(null);
    if (!over || !working) return;

    const column = findColumn(working, id)!;
    const overId = String(over.id);
    let final = working;
    if (overId !== column && overId !== id) {
      const index = working[column]!.indexOf(overId);
      if (index >= 0) final = moveItem(working, id, column, index);
    }

    const card = cardById.get(id)!;
    const statusChanged = card.statusId !== column;
    const { beforeId, afterId } = neighboursOf(final, id);
    const unchanged =
      !statusChanged && JSON.stringify(final[column]) === JSON.stringify(optimisticColumns[column]);
    if (unchanged) return;

    const statusName = columns.find((c) => c.id === column)?.name;
    startTransition(async () => {
      setOptimisticColumns(final);
      const res = await move.executeAsync({
        issueId: id,
        statusId: statusChanged ? column : undefined,
        beforeId,
        afterId,
      });
      if (res?.serverError) toast.error(res.serverError.message);
      else if (statusChanged) toast.success(`${card.key} moved to ${statusName}`);
    });
  }

  const active = activeId ? cardById.get(activeId) : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <CardFiltersBar filters={filters} onChange={setFilters} people={people} />
      {isFiltering(filters) && canEdit ? (
        <p className="-mt-2 text-xs text-muted-foreground">
          Filters are on — dropped cards are ranked among the visible ones.
        </p>
      ) : null}
      <DndContext
        id="board"
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          setDragColumns(null);
        }}
      >
        <ScrollArea className="min-h-0 w-full flex-1">
          <div className="flex h-[calc(100svh-17rem)] min-h-96 gap-3 pb-3">
            {columns.map((column) => (
              <BoardColumn
                key={column.id}
                column={column}
                cards={visible(current[column.id] ?? [])}
                slug={slug}
                canEdit={canEdit}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        <DragOverlay>{active ? <IssueCard card={active} slug={slug} overlay /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}
