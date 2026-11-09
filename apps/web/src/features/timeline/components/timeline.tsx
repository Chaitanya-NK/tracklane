"use client";

import { ChevronRightIcon, DiamondIcon, PlusIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CreateIssueButton, IssueTypeIcon } from "@/features/issues";
import { updateIssueAction } from "@/features/issues/server/actions";
import { cn } from "@/lib/utils";
import {
  addDays,
  applyDrag,
  barSpan,
  DAY_WIDTH,
  daysBetween,
  type DragMode,
  timelineRange,
  timelineScale,
  type Zoom,
} from "../math";
import type {
  TimelineEpic,
  TimelineItem,
  TimelineLink,
  TimelineRelease,
  TimelineSprint,
} from "../types";
import { APP_LOCALE } from "@/config/locale";

const ROW = 40;
const LABEL_WIDTH = 288;

const BAR_TONE = {
  todo: "bg-muted-foreground/25 border-muted-foreground/30",
  in_progress: "bg-status-in-progress/25 border-status-in-progress/50",
  done: "bg-status-done/25 border-status-done/50",
} as const;

const fmt = (value: string) =>
  new Intl.DateTimeFormat(APP_LOCALE, { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`),
  );

interface DragState {
  id: string;
  mode: DragMode;
  originX: number;
  original: { start: string; due: string };
  preview: { start: string; due: string };
  moved: boolean;
}

/**
 * Gantt-style view. Drag a bar to move it, drag an edge to change the start or due date.
 * Unscheduled issues get a "Schedule" button that starts them today for two weeks.
 */
export function Timeline({
  slug,
  epics,
  loose,
  sprints,
  today,
  canEdit,
  releases = [],
  links = [],
  projectKey,
}: {
  slug: string;
  epics: TimelineEpic[];
  loose: TimelineItem[];
  sprints: TimelineSprint[];
  today: string;
  canEdit: boolean;
  releases?: TimelineRelease[];
  links?: TimelineLink[];
  projectKey?: string;
}) {
  const [showDeps, setShowDeps] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [rowTops, setRowTops] = useState<Record<string, number>>({});
  const router = useRouter();
  const [zoom, setZoom] = useState<Zoom>("weeks");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Record<string, { start: string; due: string }>>({});
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const update = useAction(updateIssueAction);
  const scrollRoot = useRef<HTMLDivElement>(null);

  const dayWidth = DAY_WIDTH[zoom];
  const allItems = useMemo(
    () => [...epics, ...epics.flatMap((e) => e.children), ...loose],
    [epics, loose],
  );
  const range = useMemo(
    () =>
      timelineRange(
        [
          ...allItems.flatMap((i) => [i.start, i.due]),
          ...sprints.flatMap((s) => [s.start, s.end]),
          ...releases.map((r) => r.date),
        ].filter((d): d is string => Boolean(d)),
        today,
      ),
    [allItems, sprints, releases, today],
  );
  const scale = useMemo(() => timelineScale(range, zoom), [range, zoom]);
  const width = scale.totalDays * dayWidth;

  const datesOf = (item: TimelineItem) =>
    drag?.id === item.id
      ? drag.preview
      : (overrides[item.id] ??
        (item.start || item.due
          ? { start: item.start ?? item.due!, due: item.due ?? item.start! }
          : null));

  async function save(item: TimelineItem, dates: { start: string; due: string }, message: string) {
    setOverrides((o) => ({ ...o, [item.id]: dates }));
    const res = await update.executeAsync({
      issueId: item.id,
      patch: { startDate: dates.start, dueDate: dates.due },
    });
    if (res?.serverError) {
      toast.error(res.serverError.message);
      setOverrides((o) => {
        const next = { ...o };
        delete next[item.id];
        return next;
      });
      return;
    }
    toast.success(message);
  }

  function onPointerDown(event: React.PointerEvent, item: TimelineItem, mode: DragMode) {
    const dates = datesOf(item);
    if (!canEdit || !dates || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    const state = {
      id: item.id,
      mode,
      originX: event.clientX,
      original: dates,
      preview: dates,
      moved: false,
    };
    dragRef.current = state;
    setDrag(state);
  }

  function onPointerMove(event: React.PointerEvent) {
    const current = dragRef.current;
    if (!current) return;
    const delta = Math.round((event.clientX - current.originX) / dayWidth);
    const preview = applyDrag(current.original, current.mode, delta);
    const next = {
      ...current,
      preview,
      moved: current.moved || Math.abs(event.clientX - current.originX) > 3,
    };
    dragRef.current = next;
    setDrag(next);
  }

  function onPointerUp(item: TimelineItem) {
    const current = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!current) return;
    if (!current.moved) {
      router.push(`/${slug}/issues/${item.key}` as Route);
      return;
    }
    const { start, due } = current.preview;
    if (start === current.original.start && due === current.original.due) return;
    void save(item, current.preview, `${item.key} scheduled ${fmt(start)} – ${fmt(due)}`);
  }

  function renderBar(item: TimelineItem, epic: TimelineEpic | null) {
    const dates = datesOf(item);
    const span = dates ? barSpan(range.start, dates.start, dates.due) : null;
    if (!span || !dates) {
      return canEdit ? (
        <Button
          variant="outline"
          size="sm"
          className="absolute top-1/2 h-6 -translate-y-1/2 border-dashed text-xs"
          style={{ left: daysBetween(range.start, today) * dayWidth }}
          onClick={() =>
            save(
              item,
              { start: today, due: addDays(today, 13) },
              `${item.key} scheduled for two weeks from today`,
            )
          }
        >
          <PlusIcon aria-hidden="true" /> Schedule
        </Button>
      ) : null;
    }
    const done = epic ? epic.children.filter((c) => c.status.category === "done").length : 0;
    const progress =
      epic && epic.children.length ? Math.round((done / epic.children.length) * 100) : null;
    const isEpic = item.type === "epic";
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            aria-label={`${item.key} ${item.title}, ${fmt(dates.start)} to ${fmt(dates.due)}`}
            className={cn(
              "absolute top-1/2 flex h-6 -translate-y-1/2 items-center overflow-clip rounded-md border text-xs font-medium select-none",
              isEpic ? "border-violet-500/50 bg-violet-500/20" : BAR_TONE[item.status.category],
              canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
              drag?.id === item.id && "ring-2 ring-primary/40",
            )}
            style={{ left: span.offset * dayWidth, width: Math.max(span.days * dayWidth, 8) }}
            onPointerDown={(e) => onPointerDown(e, item, "move")}
            onPointerMove={onPointerMove}
            onPointerUp={() => onPointerUp(item)}
            onKeyDown={(e) =>
              e.key === "Enter" && router.push(`/${slug}/issues/${item.key}` as Route)
            }
          >
            {progress !== null ? (
              <span
                className="absolute inset-y-0 left-0 bg-violet-500/30"
                style={{ width: `${progress}%` }}
                aria-hidden="true"
              />
            ) : null}
            {canEdit ? (
              <span
                className="absolute inset-y-0 left-0 w-2 cursor-ew-resize"
                onPointerDown={(e) => onPointerDown(e, item, "start")}
                aria-hidden="true"
              />
            ) : null}
            {/* Sticks to the left edge of the visible area, so long bars keep their title in view. */}
            <span className="sticky truncate px-2" style={{ left: LABEL_WIDTH }}>
              {span.days * dayWidth > 60 ? item.title : ""}
            </span>
            {canEdit ? (
              <span
                className="absolute inset-y-0 right-0 w-2 cursor-ew-resize"
                onPointerDown={(e) => onPointerDown(e, item, "end")}
                aria-hidden="true"
              />
            ) : null}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {item.key} · {fmt(dates.start)} – {fmt(dates.due)}
          {progress !== null ? ` · ${progress}% done` : ""}
        </TooltipContent>
      </Tooltip>
    );
  }

  function renderRow(item: TimelineItem, depth: number, epic: TimelineEpic | null) {
    const isEpic = item.type === "epic";
    const open = !collapsed.has(item.id);
    return (
      <div key={item.id} data-row={item.id} className="flex border-b" style={{ height: ROW }}>
        <div
          className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r bg-background pr-2 text-sm"
          style={{ width: LABEL_WIDTH, paddingLeft: 8 + depth * 20 }}
        >
          {isEpic && epic?.children.length ? (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={open ? `Collapse ${item.key}` : `Expand ${item.key}`}
              aria-expanded={open}
              onClick={() =>
                setCollapsed((c) => {
                  const next = new Set(c);
                  if (next.has(item.id)) next.delete(item.id);
                  else next.add(item.id);
                  return next;
                })
              }
            >
              <ChevronRightIcon
                className={cn("transition-transform", open && "rotate-90")}
                aria-hidden="true"
              />
            </Button>
          ) : (
            <span className="w-6 shrink-0" />
          )}
          <IssueTypeIcon type={item.type} />
          <Link
            href={`/${slug}/issues/${item.key}` as Route}
            className="min-w-0 flex-1 truncate hover:underline"
          >
            {item.title}
          </Link>
          {item.assignee ? <UserAvatar user={item.assignee} className="size-5" /> : null}
        </div>
        <div className="relative" style={{ width }}>
          {renderBar(item, epic)}
        </div>
      </div>
    );
  }

  const todayOffset = daysBetween(range.start, today) * dayWidth;

  // Row positions for dependency arrows (rows differ in height around section headers).
  useLayoutEffect(() => {
    if (!showDeps || !bodyRef.current) return;
    const tops: Record<string, number> = {};
    for (const el of bodyRef.current.querySelectorAll<HTMLElement>("[data-row]")) {
      tops[el.dataset.row!] = el.offsetTop + ROW / 2;
    }
    setRowTops(tops);
  }, [showDeps, collapsed, epics, loose]);

  const itemById = useMemo(() => new Map(allItems.map((i) => [i.id, i])), [allItems]);
  const arrows = showDeps
    ? links.flatMap((link) => {
        const from = itemById.get(link.from);
        const to = itemById.get(link.to);
        const y1 = rowTops[link.from];
        const y2 = rowTops[link.to];
        if (!from || !to || y1 === undefined || y2 === undefined) return [];
        const a = datesOf(from);
        const b = datesOf(to);
        if (!a || !b) return [];
        const x1 = (daysBetween(range.start, a.due) + 1) * dayWidth;
        const x2 = daysBetween(range.start, b.start) * dayWidth;
        const late = b.start <= a.due;
        return [{ id: `${link.from}-${link.to}`, x1, y1, x2, y2, late }];
      })
    : [];

  // Open (and re-zoom) with today in view, a little in from the left edge.
  useEffect(() => {
    const viewport = scrollRoot.current?.querySelector<HTMLElement>(
      "[data-slot=scroll-area-viewport]",
    );
    if (viewport) viewport.scrollLeft = Math.max(0, todayOffset - 7 * dayWidth);
  }, [todayOffset, dayWidth]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={zoom}
          onValueChange={(v) => v && setZoom(v as Zoom)}
        >
          <ToggleGroupItem value="weeks">Weeks</ToggleGroupItem>
          <ToggleGroupItem value="months">Months</ToggleGroupItem>
          <ToggleGroupItem value="quarters">Quarters</ToggleGroupItem>
        </ToggleGroup>
        {links.length ? (
          <Toggle variant="outline" size="sm" pressed={showDeps} onPressedChange={setShowDeps}>
            Dependencies
          </Toggle>
        ) : null}
        {canEdit ? (
          <p className="text-xs text-muted-foreground">
            Drag bars to reschedule; drag an edge to change the start or due date.
          </p>
        ) : null}
        {canEdit && projectKey ? (
          <span className="ml-auto">
            <CreateIssueButton
              size="sm"
              variant="outline"
              label="Create epic"
              type="epic"
              projectKey={projectKey}
            />
          </span>
        ) : null}
      </div>
      <ScrollArea ref={scrollRoot} className="w-full rounded-lg border">
        <div style={{ width: LABEL_WIDTH + width }} className="relative">
          {/* Header */}
          <div className="sticky top-0 z-20 flex border-b bg-background">
            <div
              className="sticky left-0 z-10 flex shrink-0 items-end border-r bg-background px-3 pb-1 text-xs font-medium"
              style={{ width: LABEL_WIDTH }}
            >
              Work
            </div>
            <div
              className="relative"
              style={{ width, height: (scale.weeks.length ? 48 : 24) + (sprints.length ? 22 : 0) }}
            >
              {scale.months.map((m) => (
                <div
                  key={m.offset}
                  className="absolute top-0 h-6 truncate border-l px-2 text-xs leading-6 font-medium text-muted-foreground"
                  style={{ left: m.offset * dayWidth, width: m.days * dayWidth }}
                >
                  {m.label}
                </div>
              ))}
              {sprints.map((s) => (
                <div
                  key={s.name}
                  className={cn(
                    "absolute h-4 truncate rounded px-1.5 text-[10px] leading-4 font-medium",
                    s.state === "active"
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground",
                  )}
                  style={{
                    top: scale.weeks.length ? 50 : 26,
                    left: daysBetween(range.start, s.start) * dayWidth,
                    width: (daysBetween(s.start, s.end) + 1) * dayWidth,
                  }}
                >
                  {s.name}
                </div>
              ))}
              {releases.map((r) => (
                <Tooltip key={`rel-${r.name}`}>
                  <TooltipTrigger asChild>
                    <span
                      className={cn(
                        "absolute top-0 -translate-x-1/2",
                        r.released ? "text-emerald-600" : "text-violet-600",
                      )}
                      style={{ left: (daysBetween(range.start, r.date) + 0.5) * dayWidth }}
                    >
                      <DiamondIcon
                        className="size-3.5 fill-current"
                        aria-label={`Release ${r.name}`}
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {r.name} · {r.released ? "released" : "due"} {fmt(r.date)}
                  </TooltipContent>
                </Tooltip>
              ))}
              {scale.weeks.map((w) => (
                <div
                  key={w.offset}
                  className="absolute top-6 h-6 border-l px-1 text-[10px] leading-6 text-muted-foreground"
                  style={{ left: w.offset * dayWidth, width: w.days * dayWidth }}
                >
                  {w.label}
                </div>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="relative" ref={bodyRef}>
            <div
              className="pointer-events-none absolute inset-y-0"
              style={{ left: LABEL_WIDTH, width }}
              aria-hidden="true"
            >
              {sprints.map((s) => (
                <div
                  key={s.name}
                  className={cn(
                    "absolute inset-y-0 border-x border-dashed",
                    s.state === "active"
                      ? "border-primary/20 bg-primary/5"
                      : "border-border bg-muted/40",
                  )}
                  style={{
                    left: daysBetween(range.start, s.start) * dayWidth,
                    width: (daysBetween(s.start, s.end) + 1) * dayWidth,
                  }}
                ></div>
              ))}
              {releases.map((r) => (
                <div
                  key={`rel-line-${r.name}`}
                  className={cn(
                    "absolute inset-y-0 w-px border-l border-dashed",
                    r.released ? "border-emerald-500/60" : "border-violet-500/60",
                  )}
                  style={{ left: (daysBetween(range.start, r.date) + 0.5) * dayWidth }}
                />
              ))}
              <div
                className="absolute inset-y-0 w-px bg-destructive"
                style={{ left: todayOffset }}
              />
            </div>
            {arrows.length ? (
              <svg
                className="pointer-events-none absolute top-0 z-[5] h-full overflow-visible"
                style={{ left: LABEL_WIDTH, width }}
                aria-label="Dependencies"
                role="img"
              >
                <defs>
                  <marker
                    id="tl-arrow"
                    viewBox="0 0 8 8"
                    refX="7"
                    refY="4"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto"
                  >
                    <path d="M0 0 8 4 0 8z" className="fill-muted-foreground" />
                  </marker>
                  <marker
                    id="tl-arrow-late"
                    viewBox="0 0 8 8"
                    refX="7"
                    refY="4"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto"
                  >
                    <path d="M0 0 8 4 0 8z" className="fill-destructive" />
                  </marker>
                </defs>
                {arrows.map((a) => {
                  const mid = Math.max(a.x1 + 10, (a.x1 + a.x2) / 2);
                  return (
                    <path
                      key={a.id}
                      d={`M${a.x1} ${a.y1} H${mid} V${a.y2} H${a.x2 - 2}`}
                      fill="none"
                      strokeWidth={1.5}
                      className={a.late ? "stroke-destructive" : "stroke-muted-foreground"}
                      markerEnd={`url(#${a.late ? "tl-arrow-late" : "tl-arrow"})`}
                    />
                  );
                })}
              </svg>
            ) : null}
            {epics.map((epic) => (
              <Fragment key={epic.id}>
                {renderRow(epic, 0, epic)}
                {!collapsed.has(epic.id)
                  ? epic.children.map((child) => renderRow(child, 1, null))
                  : null}
              </Fragment>
            ))}
            {loose.length ? (
              <>
                <div
                  className="sticky left-0 border-b bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground"
                  style={{ width: LABEL_WIDTH }}
                >
                  Scheduled work without an epic
                </div>
                {loose.map((item) => renderRow(item, 0, null))}
              </>
            ) : null}
            {epics.length === 0 && loose.length === 0 ? (
              <p
                className="sticky left-0 px-3 py-10 text-sm text-muted-foreground"
                style={{ width: LABEL_WIDTH + 320 }}
              >
                No epics yet. Create an epic to plan work on the timeline.
              </p>
            ) : null}
          </div>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
