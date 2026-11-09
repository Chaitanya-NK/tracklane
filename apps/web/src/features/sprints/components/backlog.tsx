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
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useAction } from "next-safe-action/hooks";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  CardFiltersBar,
  type CardFilters,
  type Columns,
  EMPTY_FILTERS,
  filterOptionsFor,
  findColumn,
  isFiltering,
  matchesFilters,
  moveItem,
  neighboursOf,
  type PlanningCard,
} from "@/features/board";
import { moveIssueAction } from "@/features/issues/server/actions";
import { bulkUpdateAction } from "@/features/search/server/actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BacklogRow, SortableBacklogRow } from "./backlog-row";
import { BacklogSection, type BacklogSprint, type CapacityContext } from "./backlog-section";
import { type EpicSummary, EpicsPanel } from "./epics-panel";

export const BACKLOG_ID = "backlog";

function DroppableList({
  id,
  children,
  empty,
}: {
  id: string;
  children: React.ReactNode;
  empty: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={isOver && empty ? "rounded-b-lg bg-primary/5" : undefined}>
      {children}
    </div>
  );
}

/** Sprints (active, then planned) and the backlog. Drag rows to reorder or move between them. */
export function Backlog({
  slug,
  projectKey,
  sprints,
  backlog,
  canEdit,
  canManageSprints,
  currentUserId,
  capacity,
  epics,
}: {
  slug: string;
  projectKey: string;
  sprints: (BacklogSprint & { cards: PlanningCard[] })[];
  backlog: PlanningCard[];
  canEdit: boolean;
  canManageSprints: boolean;
  currentUserId: string;
  capacity: CapacityContext;
  epics: EpicSummary[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showEpics, setShowEpics] = useState(true);
  const bulk = useAction(bulkUpdateAction);
  const select = (id: string, on: boolean) =>
    setSelected((set) => {
      const next = new Set(set);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  async function moveSelected(target: string) {
    const ids = [...selected];
    const res = await bulk.executeAsync({
      slug,
      issueIds: ids,
      patch: { sprintId: target === BACKLOG_ID ? null : target },
    });
    if (res?.serverError) return void toast.error(res.serverError.message);
    const name =
      target === BACKLOG_ID ? "the backlog" : (sprints.find((s) => s.id === target)?.name ?? "");
    toast.success(`${res?.data?.updated ?? ids.length} issues moved to ${name}`);
    setSelected(new Set());
  }
  const allCards = useMemo(
    () => [...sprints.flatMap((s) => s.cards), ...backlog],
    [sprints, backlog],
  );
  const cardById = useMemo(() => new Map(allCards.map((c) => [c.id, c])), [allCards]);
  const serverLists = useMemo<Columns>(
    () => ({
      ...Object.fromEntries(sprints.map((s) => [s.id, s.cards.map((c) => c.id)])),
      [BACKLOG_ID]: backlog.map((c) => c.id),
    }),
    [sprints, backlog],
  );
  const [optimisticLists, setOptimisticLists] = useOptimistic(serverLists);
  const [dragLists, setDragLists] = useState<Columns | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filters, setFilters] = useState<CardFilters>(EMPTY_FILTERS);
  const [, startTransition] = useTransition();
  const move = useAction(moveIssueAction);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const lists = dragLists ?? optimisticLists;
  const canDrag = canEdit && canManageSprints;
  const people = useMemo(() => {
    const seen = new Map<string, NonNullable<PlanningCard["assignee"]>>();
    for (const card of allCards) if (card.assignee) seen.set(card.assignee.id, card.assignee);
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [allCards]);
  const cardsIn = (listId: string) =>
    (lists[listId] ?? [])
      .map((id) => cardById.get(id))
      .filter((c): c is PlanningCard => Boolean(c) && matchesFilters(c!, filters, currentUserId));
  const allIn = (listId: string) =>
    (lists[listId] ?? [])
      .map((id) => cardById.get(id))
      .filter((c): c is PlanningCard => Boolean(c));
  const sprintName = (listId: string) =>
    listId === BACKLOG_ID
      ? "the backlog"
      : (sprints.find((s) => s.id === listId)?.name ?? "the sprint");

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
    setDragLists(optimisticLists);
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over || !dragLists) return;
    const from = findColumn(dragLists, String(active.id));
    const to = findColumn(dragLists, String(over.id));
    if (!from || !to || from === to) return;
    const overIndex = dragLists[to]!.indexOf(String(over.id));
    setDragLists(moveItem(dragLists, String(active.id), to, overIndex < 0 ? undefined : overIndex));
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const id = String(active.id);
    const working = dragLists;
    setActiveId(null);
    setDragLists(null);
    if (!over || !working) return;
    const list = findColumn(working, id)!;
    let final = working;
    const overIndex = working[list]!.indexOf(String(over.id));
    if (String(over.id) !== id && overIndex >= 0) final = moveItem(working, id, list, overIndex);

    const card = cardById.get(id)!;
    const sprintId = list === BACKLOG_ID ? null : list;
    const sprintChanged = card.sprintId !== sprintId;
    if (!sprintChanged && JSON.stringify(final[list]) === JSON.stringify(optimisticLists[list]))
      return;
    const { beforeId, afterId } = neighboursOf(final, id);

    startTransition(async () => {
      setOptimisticLists(final);
      const res = await move.executeAsync({
        issueId: id,
        sprintId: sprintChanged ? sprintId : undefined,
        beforeId,
        afterId,
      });
      if (res?.serverError) toast.error(res.serverError.message);
      else if (sprintChanged) toast.success(`${card.key} moved to ${sprintName(list)}`);
    });
  }

  const active = activeId ? cardById.get(activeId) : undefined;
  const planned = sprints.filter((s) => s.state === "planned");
  const hasActive = sprints.some((s) => s.state === "active");

  const { typeOptions } = useMemo(
    () =>
      filterOptionsFor(allCards, (c) =>
        c.customType ? c.customType.name : c.type[0]!.toUpperCase() + c.type.slice(1),
      ),
    [allCards],
  );

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      {showEpics && epics.length + (canEdit ? 1 : 0) > 0 ? (
        <EpicsPanel
          epics={epics}
          selected={filters.epics}
          onSelect={(ids) => setFilters({ ...filters, epics: ids })}
          projectKey={projectKey}
          canCreate={canEdit}
        />
      ) : null}
      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <CardFiltersBar
            filters={filters}
            onChange={setFilters}
            people={people}
            typeOptions={typeOptions}
          />
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            aria-pressed={showEpics}
            onClick={() => setShowEpics((v) => !v)}
          >
            {showEpics ? "Hide epics" : "Show epics"}
          </Button>
        </div>
        <DndContext
          id="backlog"
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={() => {
            setActiveId(null);
            setDragLists(null);
          }}
        >
          {[...sprints.map((s) => s.id), BACKLOG_ID].map((listId) => {
            const sprint = sprints.find((s) => s.id === listId);
            const visible = cardsIn(listId);
            return (
              <BacklogSection
                key={listId}
                slug={slug}
                projectKey={projectKey}
                sprint={sprint ?? null}
                cards={allIn(listId)}
                visibleCount={visible.length}
                filtering={isFiltering(filters)}
                canStart={Boolean(
                  sprint &&
                  sprint.state === "planned" &&
                  !hasActive &&
                  sprint.id === planned[0]?.id,
                )}
                canManageSprints={canManageSprints}
                canCreateIssues={canEdit}
                plannedSprints={planned.filter((s) => s.id !== listId)}
                capacity={capacity}
              >
                <SortableContext
                  items={visible.map((c) => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <DroppableList id={listId} empty={visible.length === 0}>
                    {visible.map((card) => (
                      <SortableBacklogRow
                        key={card.id}
                        card={card}
                        slug={slug}
                        disabled={!canDrag}
                        selection={
                          canDrag
                            ? {
                                checked: selected.has(card.id),
                                onChange: (on) => select(card.id, on),
                              }
                            : undefined
                        }
                      />
                    ))}
                  </DroppableList>
                </SortableContext>
              </BacklogSection>
            );
          })}
          <DragOverlay>
            {active ? <BacklogRow card={active} slug={slug} overlay /> : null}
          </DragOverlay>
        </DndContext>
        {selected.size ? (
          <div
            role="region"
            aria-label="Selected issues"
            className="sticky bottom-4 z-20 mx-auto flex w-fit flex-wrap items-center gap-2 rounded-lg border bg-background px-3 py-2 shadow-lg"
          >
            <span className="text-sm font-medium">{selected.size} selected</span>
            <Select onValueChange={moveSelected} disabled={bulk.isPending}>
              <SelectTrigger size="sm" className="w-48" aria-label="Move selected to">
                <SelectValue placeholder="Move to…" />
              </SelectTrigger>
              <SelectContent>
                {sprints.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
                <SelectItem value={BACKLOG_ID}>Backlog</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
