"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ArrowRightIcon, InboxIcon, Settings2Icon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  CardFiltersBar,
  type CardFilters,
  EMPTY_FILTERS,
  matchesFilters,
  type PlanningCard,
} from "@/features/board";
import { moveIssueAction } from "@/features/issues/server/actions";
import { SortableBacklogRow } from "./backlog-row";

/**
 * The Kanban backlog: issues in the project's backlog status, ranked. They stay off the board
 * until someone moves them to the first board column.
 */
export function KanbanBacklog({
  slug,
  projectKey,
  cards,
  backlogStatusName,
  boardStatus,
  canEdit,
  currentUserId,
}: {
  slug: string;
  projectKey: string;
  cards: PlanningCard[];
  backlogStatusName: string;
  boardStatus: { id: string; name: string } | null;
  canEdit: boolean;
  currentUserId: string;
}) {
  const [ordered, setOrdered] = useOptimistic(cards);
  const [filters, setFilters] = useState<CardFilters>(EMPTY_FILTERS);
  const [, startTransition] = useTransition();
  const move = useAction(moveIssueAction);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const people = useMemo(() => {
    const seen = new Map<string, NonNullable<PlanningCard["assignee"]>>();
    for (const card of cards) if (card.assignee) seen.set(card.assignee.id, card.assignee);
    return [...seen.values()];
  }, [cards]);
  const visible = ordered.filter((c) => matchesFilters(c, filters, currentUserId));

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = ordered.findIndex((c) => c.id === active.id);
    const to = ordered.findIndex((c) => c.id === over.id);
    const next = arrayMove(ordered, from, to);
    const at = next.findIndex((c) => c.id === active.id);
    startTransition(async () => {
      setOrdered(next);
      const res = await move.executeAsync({
        issueId: String(active.id),
        beforeId: next[at - 1]?.id ?? null,
        afterId: next[at + 1]?.id ?? null,
      });
      if (res?.serverError) toast.error(res.serverError.message);
    });
  }

  function toBoard(card: PlanningCard) {
    if (!boardStatus) return;
    startTransition(async () => {
      setOrdered(ordered.filter((c) => c.id !== card.id));
      const res = await move.executeAsync({ issueId: card.id, statusId: boardStatus.id });
      if (res?.serverError) toast.error(res.serverError.message);
      else if (res?.data?.approval) toast.info(`${card.key} sent for approval`);
      else toast.success(`${card.key} moved to ${boardStatus.name}`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardFiltersBar filters={filters} onChange={setFilters} people={people} />
        <p className="text-sm text-muted-foreground">
          {cards.length} {cards.length === 1 ? "issue" : "issues"} in {backlogStatusName}
        </p>
      </div>
      {cards.length === 0 ? (
        <EmptyState
          icon={InboxIcon}
          title="The backlog is empty"
          description={`New issues created in ${backlogStatusName} wait here until they're pulled onto the board.`}
        />
      ) : (
        <DndContext
          id="kanban-backlog"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={visible.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="rounded-lg border" role="list" aria-label="Backlog">
              {visible.map((card) => (
                <SortableBacklogRow
                  key={card.id}
                  card={card}
                  slug={slug}
                  disabled={!canEdit}
                  actions={
                    canEdit && boardStatus ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 shrink-0"
                        onClick={() => toBoard(card)}
                        aria-label={`Move ${card.key} to ${boardStatus.name}`}
                      >
                        <span className="hidden md:inline">To board</span>
                        <ArrowRightIcon aria-hidden="true" />
                      </Button>
                    ) : null
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Settings2Icon className="size-3.5" aria-hidden="true" />
        The backlog status is set in{" "}
        <Link
          href={`/${slug}/projects/${projectKey}/settings/workflow` as Route}
          className="underline underline-offset-2"
        >
          workflow settings
        </Link>
        .
      </p>
    </div>
  );
}
