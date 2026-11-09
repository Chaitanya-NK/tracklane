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
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon, RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { type ReactNode, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStoredState } from "@/hooks/use-stored-state";
import { cn } from "@/lib/utils";
import { saveWidgetsAction } from "../server/actions";
import type { Widget } from "../widgets";

const INTERVALS = [
  { value: "0", label: "Auto-refresh off" },
  { value: "60", label: "Every minute" },
  { value: "300", label: "Every 5 minutes" },
  { value: "900", label: "Every 15 minutes" },
];

/** Reloads the dashboard's data on an interval (remembered per dashboard in this browser). */
export function AutoRefresh({ dashboardId }: { dashboardId: string }) {
  const router = useRouter();
  const [seconds, setSeconds] = useStoredState<string>(`tl.dashboard.refresh.${dashboardId}`, "0");
  const [pending, startTransition] = useTransition();
  const [updated, setUpdated] = useState<string | null>(null);

  useEffect(() => {
    const every = Number(seconds);
    if (!every) return;
    const id = setInterval(() => {
      startTransition(() => router.refresh());
      setUpdated(new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }));
    }, every * 1000);
    return () => clearInterval(id);
  }, [seconds, router]);

  return (
    <div className="flex items-center gap-2">
      {updated ? <span className="text-xs text-muted-foreground">Updated {updated}</span> : null}
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={pending}
        onClick={() => {
          startTransition(() => router.refresh());
          setUpdated(
            new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
          );
        }}
      >
        <RefreshCwIcon className={cn(pending && "animate-spin")} aria-hidden="true" />
        <span className="sr-only">Refresh now</span>
      </Button>
      <Select value={seconds} onValueChange={setSeconds}>
        <SelectTrigger size="sm" className="w-44" aria-label="Auto-refresh">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {INTERVALS.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SortableItem({ id, full, children }: { id: string; full: boolean; children: ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("relative", full && "lg:col-span-2", isDragging && "z-10 opacity-80")}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="absolute top-3 left-1 z-10 cursor-grab rounded p-1 text-muted-foreground hover:bg-muted"
      >
        <GripVerticalIcon className="size-4" aria-hidden="true" />
      </button>
      {children}
    </div>
  );
}

/** Edit mode: drag widgets by their handle to reorder them. */
export function SortableWidgetGrid({
  slug,
  dashboardId,
  widgets,
  nodes,
}: {
  slug: string;
  dashboardId: string;
  widgets: Widget[];
  nodes: Record<string, ReactNode>;
}) {
  const [order, setOrder] = useState(widgets.map((w) => w.id));
  const save = useAction(saveWidgetsAction, {
    onSuccess: () => toast.success("Layout saved"),
    onError: ({ error }) => {
      toast.error(error.serverError?.message ?? "Couldn't save the layout");
      setOrder(widgets.map((w) => w.id));
    },
  });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const byId = new Map(widgets.map((w) => [w.id, w]));

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const next = arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id)));
    setOrder(next);
    save.execute({ slug, dashboardId, widgets: next.map((id) => byId.get(id)!).filter(Boolean) });
  }

  return (
    <DndContext
      id="dashboard"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={order} strategy={rectSortingStrategy}>
        <div className="grid gap-4 lg:grid-cols-2">
          {order.map((id) => {
            const widget = byId.get(id);
            return widget ? (
              <SortableItem key={id} id={id} full={widget.size === "full"}>
                {nodes[id]}
              </SortableItem>
            ) : null;
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
