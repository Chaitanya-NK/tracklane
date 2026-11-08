"use client";

import { differenceInCalendarDays, format } from "date-fns";
import { CalendarIcon, FlagIcon } from "lucide-react";
import { useState } from "react";
import { parseDateValue } from "@/components/shared/date-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompleteSprintDialog } from "./complete-sprint-dialog";

export interface ActiveSprintInfo {
  id: string;
  name: string;
  goal: string;
  startDate: string | null;
  endDate: string | null;
}

/** Sprint name, dates, days left and goal above the Scrum board, with "Complete sprint". */
export function ActiveSprintHeader({
  sprint,
  doneCount,
  openCount,
  plannedSprints,
  canManage,
}: {
  sprint: ActiveSprintInfo;
  doneCount: number;
  openCount: number;
  plannedSprints: { id: string; name: string }[];
  canManage: boolean;
}) {
  const [completing, setCompleting] = useState(false);
  const start = parseDateValue(sprint.startDate);
  const end = parseDateValue(sprint.endDate);
  const daysLeft = end ? differenceInCalendarDays(end, new Date()) : null;

  return (
    <div className="flex flex-wrap items-start gap-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{sprint.name}</h2>
          {start && end ? (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <CalendarIcon className="size-3.5" aria-hidden="true" />
              {format(start, "d MMM")} – {format(end, "d MMM")}
            </span>
          ) : null}
          {daysLeft !== null ? (
            <Badge variant={daysLeft < 0 ? "destructive" : "secondary"} suppressHydrationWarning>
              {daysLeft < 0
                ? `${-daysLeft} day${daysLeft === -1 ? "" : "s"} overdue`
                : daysLeft === 0
                  ? "Ends today"
                  : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
            </Badge>
          ) : null}
        </div>
        {sprint.goal ? (
          <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <FlagIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {sprint.goal}
          </p>
        ) : null}
      </div>
      {canManage ? (
        <>
          <Button variant="outline" size="sm" onClick={() => setCompleting(true)}>
            Complete sprint
          </Button>
          <CompleteSprintDialog
            sprint={sprint}
            doneCount={doneCount}
            openCount={openCount}
            plannedSprints={plannedSprints}
            open={completing}
            onOpenChange={setCompleting}
          />
        </>
      ) : null}
    </div>
  );
}
