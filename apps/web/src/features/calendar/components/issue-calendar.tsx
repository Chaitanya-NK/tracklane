"use client";

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { IssueTypeIcon, PriorityIcon } from "@/features/issues";
import { updateIssueAction } from "@/features/issues/server/actions";
import { cn } from "@/lib/utils";
import { monthGrid, monthLabel, shiftMonth } from "../month";
import type { CalendarIssue } from "../types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_PER_DAY = 3;
const UNSCHEDULED = "unscheduled";

const dayLabel = (day: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`),
  );

function Chip({ issue, slug, overlay }: { issue: CalendarIssue; slug: string; overlay?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "flex items-center gap-1.5 rounded border bg-background px-1.5 py-0.5 text-xs shadow-xs",
            issue.status.category === "done" && "text-muted-foreground line-through",
            overlay && "shadow-lg",
          )}
        >
          <IssueTypeIcon type={issue.type} tooltip={false} />
          <Link
            href={`/${slug}/issues/${issue.key}` as Route}
            className="min-w-0 flex-1 truncate hover:underline"
            draggable={false}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <span className="sr-only">{issue.key}: </span>
            {issue.title}
          </Link>
          <PriorityIcon priority={issue.priority} tooltip={false} className="[&_svg]:size-3" />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {issue.key} · {issue.status.name}
      </TooltipContent>
    </Tooltip>
  );
}

function DraggableChip({
  issue,
  slug,
  disabled,
}: {
  issue: CalendarIssue;
  slug: string;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: issue.id,
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`${issue.key}: ${issue.title}`}
      className={cn("touch-none", !disabled && "cursor-grab", isDragging && "opacity-30")}
    >
      <Chip issue={issue} slug={slug} />
    </div>
  );
}

function DayCell({
  day,
  issues,
  slug,
  inMonth,
  isToday,
  canEdit,
}: {
  day: string;
  issues: CalendarIssue[];
  slug: string;
  inMonth: boolean;
  isToday: boolean;
  canEdit: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: day });
  const visible = issues.slice(0, MAX_PER_DAY);
  const hidden = issues.length - visible.length;
  return (
    <div
      ref={setNodeRef}
      aria-label={dayLabel(day)}
      className={cn(
        "flex min-h-28 flex-col gap-1 border-r border-b p-1.5 [&:nth-child(7n)]:border-r-0",
        !inMonth && "bg-muted/40",
        isOver && "bg-primary/10",
      )}
    >
      <span
        className={cn(
          "self-end rounded-full px-1.5 text-xs tabular-nums",
          !inMonth && "text-muted-foreground",
          isToday && "bg-primary font-semibold text-primary-foreground",
        )}
      >
        {Number(day.slice(8))}
      </span>
      {visible.map((issue) => (
        <DraggableChip key={issue.id} issue={issue} slug={slug} disabled={!canEdit} />
      ))}
      {hidden > 0 ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 justify-start px-1.5 text-xs">
              +{hidden} more
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 space-y-1 p-2">
            <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">{dayLabel(day)}</p>
            {issues.map((issue) => (
              <Chip key={issue.id} issue={issue} slug={slug} />
            ))}
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}

function UnscheduledList({
  issues,
  slug,
  canEdit,
}: {
  issues: CalendarIssue[];
  slug: string;
  canEdit: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: UNSCHEDULED });
  return (
    <Card className={cn("gap-3 py-4 xl:w-72 xl:shrink-0", isOver && "ring-2 ring-primary/40")}>
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          Unscheduled <Badge variant="secondary">{issues.length}</Badge>
        </CardTitle>
        <CardDescription className="text-xs">
          {canEdit
            ? "Drag onto a day to set its due date. Drop here to clear it."
            : "Open issues without a due date."}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        <ScrollArea className="max-h-[32rem]">
          <div ref={setNodeRef} className="flex min-h-16 flex-col gap-1.5">
            {issues.map((issue) => (
              <DraggableChip key={issue.id} issue={issue} slug={slug} disabled={!canEdit} />
            ))}
            {issues.length === 0 ? (
              <p className="text-xs text-muted-foreground">Everything open has a due date.</p>
            ) : null}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

/** Month calendar of due dates with drag-and-drop rescheduling. */
export function IssueCalendar({
  slug,
  month,
  today,
  scheduled,
  unscheduled,
  canEdit,
}: {
  slug: string;
  month: string;
  today: string;
  scheduled: CalendarIssue[];
  unscheduled: CalendarIssue[];
  canEdit: boolean;
}) {
  const pathname = usePathname();
  const all = useMemo(() => [...scheduled, ...unscheduled], [scheduled, unscheduled]);
  const [optimistic, setOptimistic] = useOptimistic(
    all,
    (state, move: { id: string; due: string | null }) =>
      state.map((i) => (i.id === move.id ? { ...i, due: move.due } : i)),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const update = useAction(updateIssueAction);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const days = monthGrid(month);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarIssue[]>();
    for (const issue of optimistic)
      if (issue.due) map.set(issue.due, [...(map.get(issue.due) ?? []), issue]);
    return map;
  }, [optimistic]);

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;
    const issue = optimistic.find((i) => i.id === active.id);
    const due = over.id === UNSCHEDULED ? null : String(over.id);
    if (!issue || issue.due === due) return;
    startTransition(async () => {
      setOptimistic({ id: issue.id, due });
      const res = await update.executeAsync({ issueId: issue.id, patch: { dueDate: due } });
      if (res?.serverError) toast.error(res.serverError.message);
      else
        toast.success(due ? `${issue.key} due ${dayLabel(due)}` : `${issue.key} due date cleared`);
    });
  }

  const active = activeId ? optimistic.find((i) => i.id === activeId) : undefined;
  const monthHref = (m: string) => `${pathname}?month=${m}` as Route;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{monthLabel(month)}</h2>
            <div className="ml-auto flex items-center gap-1">
              <Button asChild variant="outline" size="icon-sm" aria-label="Previous month">
                <Link href={monthHref(shiftMonth(month, -1))}>
                  <ChevronLeftIcon aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={monthHref(today.slice(0, 7))}>Today</Link>
              </Button>
              <Button asChild variant="outline" size="icon-sm" aria-label="Next month">
                <Link href={monthHref(shiftMonth(month, 1))}>
                  <ChevronRightIcon aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border">
            <div className="grid grid-cols-7 border-b bg-muted/50">
              {WEEKDAYS.map((d) => (
                <div key={d} className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day) => (
                <DayCell
                  key={day}
                  day={day}
                  slug={slug}
                  issues={byDay.get(day) ?? []}
                  inMonth={day.startsWith(month)}
                  isToday={day === today}
                  canEdit={canEdit}
                />
              ))}
            </div>
          </div>
        </div>
        <UnscheduledList issues={optimistic.filter((i) => !i.due)} slug={slug} canEdit={canEdit} />
      </div>
      <DragOverlay>{active ? <Chip issue={active} slug={slug} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}
