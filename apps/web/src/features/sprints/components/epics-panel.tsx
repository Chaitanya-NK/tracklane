"use client";

import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CreateIssueButton } from "@/features/issues";
import { cn } from "@/lib/utils";

export interface EpicSummary {
  id: string;
  key: string;
  title: string;
  done: boolean;
  total: number;
  completed: number;
  points: number;
}

/** Backlog side panel: epics with progress; click one to filter the backlog by it. */
export function EpicsPanel({
  epics,
  selected,
  onSelect,
  projectKey,
  canCreate,
}: {
  epics: EpicSummary[];
  selected: string[];
  onSelect: (ids: string[]) => void;
  projectKey: string;
  canCreate: boolean;
}) {
  const open = epics.filter((e) => !e.done);
  return (
    <aside aria-label="Epics" className="w-full shrink-0 space-y-2 lg:w-64">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Epics</h2>
        {selected.length ? (
          <Button variant="ghost" size="sm" className="h-7" onClick={() => onSelect([])}>
            <XIcon aria-hidden="true" /> Clear
          </Button>
        ) : null}
      </div>
      <button
        type="button"
        aria-pressed={selected.length === 0}
        onClick={() => onSelect([])}
        className={cn(
          "w-full rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
          selected.length === 0 && "border-primary/40 bg-primary/5",
        )}
      >
        All issues
      </button>
      <ul className="space-y-1.5">
        {open.map((epic) => {
          const active = selected.includes(epic.id);
          const pct = epic.total ? Math.round((epic.completed / epic.total) * 100) : 0;
          return (
            <li key={epic.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() =>
                  onSelect(
                    active ? selected.filter((id) => id !== epic.id) : [...selected, epic.id],
                  )
                }
                className={cn(
                  "w-full space-y-1.5 rounded-md border bg-background px-3 py-2 text-left transition-colors hover:bg-muted",
                  active && "border-primary/40 bg-primary/5",
                )}
              >
                <span className="flex items-baseline gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{epic.key}</span>
                  <span className="truncate text-sm font-medium">{epic.title}</span>
                </span>
                <Progress value={pct} className="h-1.5" aria-label={`${pct}% done`} />
                <span className="flex justify-between text-xs text-muted-foreground tabular-nums">
                  <span>
                    {epic.completed}/{epic.total} done
                  </span>
                  <span>{epic.points} pts</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {open.length === 0 ? <p className="text-xs text-muted-foreground">No open epics.</p> : null}
      {canCreate ? (
        <CreateIssueButton
          variant="outline"
          size="sm"
          label="Create epic"
          projectKey={projectKey}
          type="epic"
        />
      ) : null}
    </aside>
  );
}
