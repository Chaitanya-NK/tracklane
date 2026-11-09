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
import { UserAvatar } from "@/components/shared/user-avatar";
import { cn } from "@/lib/utils";
import { planCapacity, workingDays } from "../capacity";
import { saveSprintCapacityAction, startSprintAction, updateSprintAction } from "../server/actions";

export interface CapacityMember {
  person: { id: string; name: string; image: string | null };
  userId: string;
  daysOff: number;
  points: number | null;
  assigned: number;
}

/** Days off and capacity per person, with the team total against committed points. */
function CapacityTable({
  members,
  onChange,
  velocity,
  days,
}: {
  members: CapacityMember[];
  onChange: (members: CapacityMember[]) => void;
  velocity: number | null;
  days: number;
}) {
  const plan = planCapacity(members, { velocity, days });
  const set = (userId: string, patch: Partial<CapacityMember>) =>
    onChange(members.map((m) => (m.userId === userId ? { ...m, ...patch } : m)));
  const over = plan.total !== null && plan.assigned > plan.total;
  return (
    <Field>
      <FieldLabel>Team capacity</FieldLabel>
      <p className="-mt-1 text-xs text-muted-foreground">
        {days} working days ·{" "}
        {velocity !== null
          ? `velocity ${velocity} pts (last 3 sprints), shared by days available`
          : "no velocity yet — enter points per person"}
      </p>
      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">Person</th>
              <th className="w-20 px-2 py-1.5 text-left font-medium">Days off</th>
              <th className="w-24 px-2 py-1.5 text-left font-medium">Capacity</th>
              <th className="w-20 px-2 py-1.5 text-right font-medium">Assigned</th>
            </tr>
          </thead>
          <tbody>
            {plan.rows.map((row, i) => {
              const m = members[i]!;
              return (
                <tr key={row.userId} className="border-t">
                  <td className="px-2 py-1">
                    <span className="flex items-center gap-2">
                      <UserAvatar user={m.person} />
                      <span className="truncate">{m.person.name}</span>
                    </span>
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      type="number"
                      min={0}
                      max={days}
                      value={m.daysOff}
                      aria-label={`Days off for ${m.person.name}`}
                      className="h-7 w-16"
                      onChange={(e) =>
                        set(m.userId, { daysOff: Math.max(0, Number(e.target.value) || 0) })
                      }
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      type="number"
                      min={0}
                      value={m.points ?? ""}
                      placeholder={row.capacity !== null ? String(row.capacity) : "—"}
                      aria-label={`Capacity in points for ${m.person.name}`}
                      className="h-7 w-20"
                      onChange={(e) =>
                        set(m.userId, {
                          points:
                            e.target.value === "" ? null : Math.max(0, Number(e.target.value)),
                        })
                      }
                    />
                  </td>
                  <td
                    className={cn(
                      "px-2 py-1 text-right tabular-nums",
                      row.over && "font-medium text-destructive",
                    )}
                  >
                    {row.assigned} pts
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t bg-muted/30 text-xs">
            <tr>
              <td className="px-2 py-1.5 font-medium" colSpan={2}>
                Team
              </td>
              <td className="px-2 py-1.5 font-medium tabular-nums">
                {plan.total !== null ? `${plan.total} pts` : "—"}
              </td>
              <td
                className={cn(
                  "px-2 py-1.5 text-right font-medium tabular-nums",
                  over && "text-destructive",
                )}
              >
                {plan.assigned} pts
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {over ? (
        <Alert variant="destructive">
          <AlertDescription>
            The sprint holds {plan.assigned - plan.total!} points more than the team can take on.
          </AlertDescription>
        </Alert>
      ) : null}
    </Field>
  );
}

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
  capacity,
}: {
  mode: "start" | "edit";
  sprint: SprintFormValue;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issueCount?: number;
  capacity?: { members: CapacityMember[]; velocity: number | null };
}) {
  const [members, setMembers] = useState(capacity?.members ?? []);
  const saveCapacity = useAction(saveSprintCapacityAction);
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
    if (mode === "start" && members.length) {
      const saved = await saveCapacity.executeAsync({
        sprintId: sprint.id,
        rows: members
          .filter((m) => m.daysOff > 0 || m.points !== null)
          .map((m) => ({ userId: m.userId, daysOff: m.daysOff, points: m.points })),
      });
      if (saved?.serverError) return setError(saved.serverError.message);
    }
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
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
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
            {mode === "start" && members.length && startDate && endDate ? (
              <CapacityTable
                members={members}
                onChange={setMembers}
                velocity={capacity?.velocity ?? null}
                days={workingDays(startDate, endDate)}
              />
            ) : null}
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
