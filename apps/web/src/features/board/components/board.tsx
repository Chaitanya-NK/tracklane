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
import { allowedTargets, type TransitionRule } from "@tracklane/core";
import { ChevronDownIcon, Rows3Icon } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PriorityIcon } from "@/features/issues";
import { moveIssueAction } from "@/features/issues/server/actions";
import { cn } from "@/lib/utils";
import { type Columns, findColumn, moveItem, neighboursOf } from "../columns";
import {
  type CardFilters,
  EMPTY_FILTERS,
  filterOptionsFor,
  isFiltering,
  matchesFilters,
} from "../filters";
import {
  cellId,
  cellsFrom,
  type Lane,
  LANE_GROUPING_LABELS,
  LANE_GROUPINGS,
  type LaneGrouping,
  lanePatchFor,
  laneProblem,
  lanesFor,
  parseCellId,
} from "../lanes";
import type { BoardColumn as Column, PlanningCard } from "../types";
import { BoardColumn, type ColumnContext, ColumnHeader } from "./board-column";
import { CardFiltersBar } from "./card-filters-bar";
import { IssueCard } from "./issue-card";

const isGrouping = (value: string | null): value is LaneGrouping =>
  (LANE_GROUPINGS as readonly string[]).includes(value ?? "");

/**
 * Drag cards between columns (changes status), within a column (changes rank) and, with
 * swimlanes, between lanes (changes the lane's field). Moves show immediately and roll back if
 * the server refuses them. Columns the workflow won't allow are dimmed while dragging.
 */
export function Board({
  slug,
  columns,
  cards,
  canEdit,
  currentUserId,
  transitions,
  columnContext,
}: {
  slug: string;
  columns: Column[];
  cards: PlanningCard[];
  canEdit: boolean;
  currentUserId: string;
  transitions: { restrict: boolean; rules: TransitionRule[] };
  columnContext?: ColumnContext;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const lanesParam = searchParams.get("lanes");
  const grouping: LaneGrouping = isGrouping(lanesParam) ? lanesParam : "none";

  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const lanes = useMemo(() => lanesFor(cards, grouping), [cards, grouping]);
  const serverCells = useMemo(
    () => cellsFrom(columns, lanes, cards, grouping),
    [columns, lanes, cards, grouping],
  );
  const [optimisticCells, setOptimisticCells] = useOptimistic(serverCells);
  const [dragCells, setDragCells] = useState<Columns | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filters, setFilters] = useState<CardFilters>(EMPTY_FILTERS);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [, startTransition] = useTransition();
  const move = useAction(moveIssueAction);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const current = dragCells ?? optimisticCells;
  const active = activeId ? cardById.get(activeId) : undefined;
  // While dragging: the statuses the workflow lets the card move to.
  const reachable = useMemo(
    () =>
      active
        ? new Set(
            allowedTargets({
              ...transitions,
              fromStatusId: active.statusId,
              statusIds: columns.map((c) => c.id),
            }),
          )
        : null,
    [active, transitions, columns],
  );
  const canDropIn = (cell: string) => {
    const parsed = parseCellId(cell);
    return !parsed || !reachable || reachable.has(parsed.statusId);
  };

  const people = useMemo(() => {
    const seen = new Map<string, NonNullable<PlanningCard["assignee"]>>();
    for (const card of cards) if (card.assignee) seen.set(card.assignee.id, card.assignee);
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [cards]);

  const { typeOptions, epicOptions } = useMemo(
    () =>
      filterOptionsFor(cards, (c) =>
        c.customType ? c.customType.name : c.type[0]!.toUpperCase() + c.type.slice(1),
      ),
    [cards],
  );

  const visible = (ids: string[]) =>
    ids
      .map((id) => cardById.get(id))
      .filter(
        (card): card is PlanningCard =>
          Boolean(card) && matchesFilters(card!, filters, currentUserId),
      );

  function setGrouping(next: LaneGrouping) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "none") params.delete("lanes");
    else params.set("lanes", next);
    const query = params.toString();
    // Shallow: the server renders the same data whatever the grouping.
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
    setDragCells(optimisticCells);
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over || !dragCells) return;
    const from = findColumn(dragCells, String(active.id));
    const to = findColumn(dragCells, String(over.id));
    if (!from || !to || from === to || !canDropIn(to)) return;
    const overIndex = dragCells[to]!.indexOf(String(over.id));
    setDragCells(moveItem(dragCells, String(active.id), to, overIndex < 0 ? undefined : overIndex));
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const id = String(active.id);
    const working = dragCells;
    setActiveId(null);
    setDragCells(null);
    if (!over || !working) return;

    const cell = findColumn(working, id)!;
    const overId = String(over.id);
    let final = working;
    if (overId !== cell && overId !== id) {
      const index = working[cell]!.indexOf(overId);
      if (index >= 0) final = moveItem(working, id, cell, index);
    }

    const card = cardById.get(id)!;
    const { laneId, statusId } = parseCellId(cell)!;
    const lane = lanes.find((l) => l.id === laneId)!;
    const problem = laneProblem(card, lane, grouping);
    if (problem) return void toast.error(problem);
    const patch = lanePatchFor(card, lane, grouping);
    const statusChanged = card.statusId !== statusId;
    const { beforeId, afterId } = neighboursOf(final, id);
    const unchanged =
      !statusChanged &&
      Object.keys(patch).length === 0 &&
      JSON.stringify(final[cell]) === JSON.stringify(optimisticCells[cell]);
    if (unchanged) return;

    const statusName = columns.find((c) => c.id === statusId)?.name;
    startTransition(async () => {
      setOptimisticCells(final);
      const res = await move.executeAsync({
        issueId: id,
        statusId: statusChanged ? statusId : undefined,
        beforeId,
        afterId,
        ...patch,
      });
      if (res?.serverError) toast.error(res.serverError.message);
      else if (res?.data?.approval)
        toast.info(`${card.key} sent for approval`, {
          description: `It moves to ${res.data.approval.toStatus} once approved.`,
        });
      else if (statusChanged) toast.success(`${card.key} moved to ${statusName}`);
      else if (Object.keys(patch).length) toast.success(`${card.key} moved to ${lane.title}`);
    });
  }

  const toggleLane = (laneId: string) =>
    setCollapsed((set) => {
      const next = new Set(set);
      if (next.has(laneId)) next.delete(laneId);
      else next.add(laneId);
      return next;
    });

  const cellsOf = (lane: Lane) =>
    columns.map((column) => {
      const id = cellId(lane.id, column.id);
      return { id, column, cards: visible(current[id] ?? []) };
    });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardFiltersBar
          filters={filters}
          onChange={setFilters}
          people={people}
          typeOptions={typeOptions}
          epicOptions={epicOptions}
        />
        <Select value={grouping} onValueChange={(v) => setGrouping(v as LaneGrouping)}>
          <SelectTrigger size="sm" className="w-48" aria-label="Swimlanes">
            <Rows3Icon className="text-muted-foreground" aria-hidden="true" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {LANE_GROUPINGS.map((g) => (
              <SelectItem key={g} value={g}>
                {g === "none" ? LANE_GROUPING_LABELS[g] : `Lanes: ${LANE_GROUPING_LABELS[g]}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
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
          setDragCells(null);
        }}
      >
        <ScrollArea className="min-h-0 w-full flex-1">
          {grouping === "none" ? (
            <div className="flex h-[calc(100svh-17rem)] min-h-96 gap-3 pb-3">
              {cellsOf(lanes[0]!).map(({ id, column, cards: cellCards }) => (
                <BoardColumn
                  key={id}
                  droppableId={id}
                  column={column}
                  cards={cellCards}
                  slug={slug}
                  canEdit={canEdit}
                  blocked={!canDropIn(id)}
                  ctx={columnContext}
                />
              ))}
            </div>
          ) : (
            <div className="h-[calc(100svh-17rem)] min-h-96 pb-3">
              <div className="w-max space-y-3">
                <div className="sticky top-0 z-10 flex gap-3 bg-background pb-1">
                  {columns.map((column) => {
                    const count = lanes.reduce(
                      (n, lane) => n + visible(current[cellId(lane.id, column.id)] ?? []).length,
                      0,
                    );
                    return (
                      <div
                        key={column.id}
                        className={cn(
                          "w-72 shrink-0 rounded-lg border bg-muted/50",
                          reachable && !reachable.has(column.id) && "opacity-40",
                        )}
                      >
                        <ColumnHeader column={column} count={count} ctx={columnContext} />
                      </div>
                    );
                  })}
                </div>
                {lanes.map((lane) => {
                  const cells = cellsOf(lane);
                  const total = cells.reduce((n, c) => n + c.cards.length, 0);
                  const open = !collapsed.has(lane.id);
                  return (
                    <section key={lane.id} aria-label={`Lane: ${lane.title}`} className="space-y-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="sticky left-0 h-7 gap-2 px-2"
                        onClick={() => toggleLane(lane.id)}
                        aria-expanded={open}
                      >
                        <ChevronDownIcon
                          className={cn("transition-transform", !open && "-rotate-90")}
                          aria-hidden="true"
                        />
                        <LaneTitle lane={lane} />
                        <Badge variant="secondary" className="h-5 rounded-full px-1.5 tabular-nums">
                          {total}
                        </Badge>
                      </Button>
                      {open ? (
                        <div className="flex gap-3">
                          {cells.map(({ id, column, cards: cellCards }) => (
                            <BoardColumn
                              key={id}
                              droppableId={id}
                              column={column}
                              cards={cellCards}
                              slug={slug}
                              canEdit={canEdit}
                              blocked={!canDropIn(id)}
                              compact
                            />
                          ))}
                        </div>
                      ) : null}
                    </section>
                  );
                })}
              </div>
            </div>
          )}
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        <DragOverlay>{active ? <IssueCard card={active} slug={slug} overlay /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}

function LaneTitle({ lane }: { lane: Lane }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
      {lane.assignee ? <UserAvatar user={lane.assignee} className="size-5" /> : null}
      {lane.priority ? <PriorityIcon priority={lane.priority} tooltip={false} /> : null}
      {lane.epicKey ? (
        <span className="font-mono text-xs font-normal text-muted-foreground">{lane.epicKey}</span>
      ) : null}
      <span className="truncate">{lane.title}</span>
    </span>
  );
}
