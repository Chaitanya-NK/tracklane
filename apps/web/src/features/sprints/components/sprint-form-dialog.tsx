"use client";

import { useAction } from "next-safe-action/hooks";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { DatePicker } from "@/components/shared/date-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { startSprintAction, updateSprintAction } from "../server/actions";

export interface SprintFormValue {
  id: string;
  name: string;
  goal: string;
  startDate: string | null;
  endDate: string | null;
}

const DAY = 24 * 60 * 60 * 1000;
const DURATIONS = [1, 2, 3, 4] as const;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addWeeks(date: string, weeks: number) {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + weeks * 7 * DAY)
    .toISOString()
    .slice(0, 10);
}

/** Start a planned sprint, or edit a sprint's name, goal and dates. */
export function SprintFormDialog({
  mode,
  sprint,
  open,
  onOpenChange,
  issueCount,
}: {
  mode: "start" | "edit";
  sprint: SprintFormValue;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issueCount?: number;
}) {
  const [name, setName] = useState(sprint.name);
  const [goal, setGoal] = useState(sprint.goal);
  // Starting a sprint defaults to today + 2 weeks.
  const [startDate, setStartDate] = useState(
    () => sprint.startDate ?? (mode === "start" ? today() : null),
  );
  const [endDate, setEndDate] = useState(
    () => sprint.endDate ?? (mode === "start" ? addWeeks(today(), 2) : null),
  );
  const [error, setError] = useState<string | null>(null);
  const start = useAction(startSprintAction);
  const edit = useAction(updateSprintAction);
  const pending = start.isPending || edit.isPending;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError("Give the sprint a name");
    if (mode === "start" && (!startDate || !endDate)) return setError("Pick a start and end date");
    if (startDate && endDate && endDate < startDate)
      return setError("The end date must be after the start date");
    setError(null);
    const res =
      mode === "start"
        ? await start.executeAsync({
            sprintId: sprint.id,
            name,
            goal,
            startDate: startDate!,
            endDate: endDate!,
          })
        : await edit.executeAsync({ sprintId: sprint.id, name, goal, startDate, endDate });
    if (res?.serverError) return setError(res.serverError.message);
    toast.success(mode === "start" ? `${name} started` : "Sprint updated");
    onOpenChange(false);
  }

  let footerNote: ReactNode = null;
  if (mode === "start" && issueCount === 0) {
    footerNote = (
      <Alert>
        <AlertDescription>
          This sprint has no issues yet. You can still start it and add issues later.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "start" ? "Start sprint" : "Edit sprint"}</DialogTitle>
          <DialogDescription>
            {mode === "start"
              ? `${issueCount ?? 0} issue${issueCount === 1 ? "" : "s"} will be included in this sprint.`
              : "Change the name, goal or dates."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate>
          <FieldGroup>
            {footerNote}
            <Field>
              <FieldLabel htmlFor="sprint-name">Sprint name</FieldLabel>
              <Input
                id="sprint-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
              />
            </Field>
            {mode === "start" ? (
              <Field>
                <FieldLabel>Duration</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {DURATIONS.map((weeks) => (
                    <Button
                      key={weeks}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const from = startDate ?? today();
                        setStartDate(from);
                        setEndDate(addWeeks(from, weeks));
                      }}
                    >
                      {weeks} week{weeks > 1 ? "s" : ""}
                    </Button>
                  ))}
                </div>
              </Field>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="sprint-start">Start date</FieldLabel>
                <DatePicker
                  id="sprint-start"
                  value={startDate}
                  onChange={setStartDate}
                  placeholder="Not set"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="sprint-end">End date</FieldLabel>
                <DatePicker
                  id="sprint-end"
                  value={endDate}
                  onChange={setEndDate}
                  placeholder="Not set"
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="sprint-goal">Sprint goal</FieldLabel>
              <Textarea
                id="sprint-goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="What should this sprint achieve?"
              />
            </Field>
            {error ? <FieldError>{error}</FieldError> : null}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner /> : null}
              {mode === "start" ? "Start" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
