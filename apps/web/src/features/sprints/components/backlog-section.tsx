"use client";

import { format } from "date-fns";
import { ChevronRightIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { parseDateValue } from "@/components/shared/date-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PlanningCard } from "@/features/board";
import { CreateIssueButton } from "@/features/issues";
import { cn } from "@/lib/utils";
import { createSprintAction, deleteSprintAction } from "../server/actions";
import { CompleteSprintDialog } from "./complete-sprint-dialog";
import { SprintFormDialog } from "./sprint-form-dialog";

export interface BacklogSprint {
  id: string;
  name: string;
  goal: string;
  state: "planned" | "active" | "completed";
  startDate: string | null;
  endDate: string | null;
}

const CATEGORY_TONE = {
  todo: "bg-muted text-muted-foreground",
  in_progress: "bg-status-in-progress/12 text-status-in-progress",
  done: "bg-status-done/12 text-status-done",
} as const;

/** Issue counts per status category, like Jira's coloured totals. */
function CategoryTotals({ cards }: { cards: PlanningCard[] }) {
  const counts = { todo: 0, in_progress: 0, done: 0 };
  for (const c of cards) counts[c.status.category] += 1;
  return (
    <span className="flex gap-1">
      {(Object.keys(counts) as (keyof typeof counts)[]).map((category) => (
        <Tooltip key={category}>
          <TooltipTrigger asChild>
            <Badge
              variant="secondary"
              className={cn(
                "h-5 min-w-6 rounded-full px-1.5 tabular-nums",
                CATEGORY_TONE[category],
              )}
            >
              {counts[category]}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {category === "todo" ? "To do" : category === "in_progress" ? "In progress" : "Done"}
          </TooltipContent>
        </Tooltip>
      ))}
    </span>
  );
}

function CreateSprintButton({ slug, projectKey }: { slug: string; projectKey: string }) {
  const create = useAction(createSprintAction, {
    onSuccess: ({ data }) => data && toast.success(`${data.name} created`),
    onError: ({ error }) => toast.error(error.serverError?.message ?? "Couldn't create the sprint"),
  });
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={create.isPending}
      onClick={() => create.execute({ slug, projectKey })}
    >
      {create.isPending ? <Spinner /> : null}
      Create sprint
    </Button>
  );
}

export function BacklogSection({
  slug,
  projectKey,
  sprint,
  cards,
  visibleCount,
  filtering,
  canStart,
  canManageSprints,
  canCreateIssues,
  plannedSprints,
  children,
}: {
  slug: string;
  projectKey: string;
  sprint: BacklogSprint | null;
  cards: PlanningCard[];
  visibleCount: number;
  filtering: boolean;
  canStart: boolean;
  canManageSprints: boolean;
  canCreateIssues: boolean;
  plannedSprints: { id: string; name: string }[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const [dialog, setDialog] = useState<"start" | "edit" | "complete" | "delete" | null>(null);
  const remove = useAction(deleteSprintAction);
  // The section unmounts once the sprint is gone, so toast after awaiting (not in onSuccess).
  async function deleteSprint(sprintId: string) {
    const res = await remove.executeAsync({ sprintId });
    if (res?.serverError) return toast.error(res.serverError.message);
    if (res?.data) toast.success(`${res.data.name} deleted; its issues moved to the backlog`);
  }
  const points = cards.reduce((sum, c) => sum + (c.estimate ?? 0), 0);
  const start = parseDateValue(sprint?.startDate);
  const end = parseDateValue(sprint?.endDate);
  const done = cards.filter((c) => c.status.category === "done").length;

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <section
        aria-label={sprint?.name ?? "Backlog"}
        className={cn(
          "rounded-lg border bg-muted/30",
          sprint?.state === "active" && "border-primary/30",
        )}
      >
        <header className="flex flex-wrap items-center gap-2 px-3 py-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="-ml-1 gap-1.5 px-1.5 font-semibold">
              <ChevronRightIcon
                className={cn("transition-transform", open && "rotate-90")}
                aria-hidden="true"
              />
              {sprint?.name ?? "Backlog"}
            </Button>
          </CollapsibleTrigger>
          {sprint?.state === "active" ? <Badge>Active</Badge> : null}
          {start && end ? (
            <span className="text-xs text-muted-foreground">
              {format(start, "d MMM")} – {format(end, "d MMM")}
            </span>
          ) : null}
          <span className="text-xs text-muted-foreground">
            {filtering ? `${visibleCount} of ${cards.length}` : cards.length} issue
            {cards.length === 1 ? "" : "s"}
            {points ? ` · ${points} pts` : ""}
          </span>
          <span className="ml-auto flex items-center gap-2">
            <CategoryTotals cards={cards} />
            {canManageSprints ? (
              sprint ? (
                <>
                  {sprint.state === "active" ? (
                    <Button size="sm" variant="outline" onClick={() => setDialog("complete")}>
                      Complete sprint
                    </Button>
                  ) : canStart ? (
                    <Button size="sm" onClick={() => setDialog("start")}>
                      Start sprint
                    </Button>
                  ) : null}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`${sprint.name} actions`}>
                        <MoreHorizontalIcon aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setDialog("edit")}>
                        <PencilIcon aria-hidden="true" /> Edit sprint
                      </DropdownMenuItem>
                      {sprint.state === "planned" ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setDialog("delete")}
                          >
                            <Trash2Icon aria-hidden="true" /> Delete sprint
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <CreateSprintButton slug={slug} projectKey={projectKey} />
              )
            ) : null}
          </span>
        </header>
        {sprint?.goal && open ? (
          <p className="-mt-1 px-4 pb-2 text-xs text-muted-foreground">{sprint.goal}</p>
        ) : null}
        <CollapsibleContent>
          <div className="mx-2 overflow-hidden rounded-md border bg-background">
            {children}
            {visibleCount === 0 ? (
              <p className="px-3 py-5 text-center text-sm text-muted-foreground">
                {filtering
                  ? "No issues match the filters."
                  : sprint
                    ? "Plan this sprint by dragging issues here from the backlog."
                    : "The backlog is empty."}
              </p>
            ) : null}
          </div>
          {canCreateIssues ? (
            <div className="px-2 py-1.5">
              <CreateIssueButton
                variant="ghost"
                size="sm"
                label="Create issue"
                projectKey={projectKey}
                sprintId={sprint?.id ?? null}
              />
            </div>
          ) : (
            <div className="h-2" />
          )}
        </CollapsibleContent>

        {sprint && dialog === "start" ? (
          <SprintFormDialog
            mode="start"
            open
            onOpenChange={(o) => !o && setDialog(null)}
            issueCount={cards.length}
            sprint={sprint}
          />
        ) : null}
        {sprint && dialog === "edit" ? (
          <SprintFormDialog
            mode="edit"
            open
            onOpenChange={(o) => !o && setDialog(null)}
            sprint={sprint}
          />
        ) : null}
        {sprint && sprint.state === "active" ? (
          <CompleteSprintDialog
            sprint={sprint}
            doneCount={done}
            openCount={cards.length - done}
            plannedSprints={plannedSprints}
            open={dialog === "complete"}
            onOpenChange={(o) => !o && setDialog(null)}
          />
        ) : null}
        {sprint ? (
          <ConfirmDialog
            open={dialog === "delete"}
            onOpenChange={(o) => !o && setDialog(null)}
            title={`Delete ${sprint.name}?`}
            description="Its issues move back to the backlog. Nothing else is deleted."
            pending={remove.isPending}
            onConfirm={() => deleteSprint(sprint.id)}
          />
        ) : null}
      </section>
    </Collapsible>
  );
}
