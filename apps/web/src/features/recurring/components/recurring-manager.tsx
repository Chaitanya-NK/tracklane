"use client";

import {
  describeRecurrence,
  ISSUE_TYPE_LABELS,
  type IssueType,
  type Priority,
  PRIORITIES,
  PRIORITY_LABELS,
  type RecurrenceFrequency,
} from "@tracklane/core";
import { MoreHorizontalIcon, PlusIcon, RepeatIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { IssueTypeIcon } from "@/features/issues";
import { formatDate } from "@/lib/format";
import {
  deleteRecurringAction,
  saveRecurringAction,
  setRecurringEnabledAction,
} from "../server/actions";

export interface RecurringRow {
  id: string;
  title: string;
  description: string;
  type: IssueType;
  priority: Priority;
  assigneeId: string | null;
  frequency: RecurrenceFrequency;
  days: number[];
  dueInDays: number | null;
  enabled: boolean;
  nextRunAt: Date;
  lastRunAt: Date | null;
}

type People = { id: string; name: string }[];
const TYPES = ["task", "story", "bug"] as const;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function RecurringManager({
  slug,
  projectKey,
  rows,
  people,
  canEdit,
}: {
  slug: string;
  projectKey: string;
  rows: RecurringRow[];
  people: People;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<RecurringRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<RecurringRow | null>(null);
  const toggle = useAction(setRecurringEnabledAction);
  const remove = useAction(deleteRecurringAction);

  return (
    <section className="max-w-4xl space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Recurring issues</h2>
          <p className="text-sm text-muted-foreground">
            Issues created on a schedule, at midnight UTC, for chores like releases, reviews and
            reports.
          </p>
        </div>
        {canEdit ? (
          <Button onClick={() => setEditing("new")}>
            <PlusIcon />
            New recurring issue
          </Button>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon={RepeatIcon}
          title="Nothing recurring yet"
          description="For example: a weekly dependency update, every Monday."
        />
      ) : (
        <ul className="divide-y rounded-lg border">
          {rows.map((row) => (
            <li key={row.id} className="flex items-start gap-3 p-3">
              <Switch
                checked={row.enabled}
                disabled={!canEdit}
                aria-label={`${row.title} enabled`}
                onCheckedChange={async (enabled) => {
                  const res = await toggle.executeAsync({ slug, projectKey, id: row.id, enabled });
                  if (res?.serverError) toast.error(res.serverError.message);
                }}
              />
              <div className="min-w-0 flex-1 text-sm">
                <p className="flex items-center gap-1.5 font-medium">
                  <IssueTypeIcon type={row.type} />
                  <span className="truncate">{row.title}</span>
                </p>
                <p className="text-muted-foreground">
                  {describeRecurrence(row.frequency, row.days)}
                  {row.dueInDays !== null
                    ? ` · due ${row.dueInDays === 0 ? "the same day" : `${row.dueInDays}d later`}`
                    : ""}
                  {row.assigneeId
                    ? ` · ${people.find((p) => p.id === row.assigneeId)?.name ?? "assigned"}`
                    : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.enabled ? `Next: ${formatDate(row.nextRunAt)}` : "Paused"}
                  {row.lastRunAt ? ` · last created ${formatDate(row.lastRunAt)}` : ""}
                </p>
              </div>
              {canEdit ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`Actions for ${row.title}`}
                    >
                      <MoreHorizontalIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditing(row)}>Edit</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(row)}>
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {editing ? (
        <RecurringDialog
          key={editing === "new" ? "new" : editing.id}
          slug={slug}
          projectKey={projectKey}
          row={editing === "new" ? undefined : editing}
          people={people}
          onClose={() => setEditing(null)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.title}?`}
        description="Issues it already created are kept."
        pending={remove.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          const res = await remove.executeAsync({ slug, projectKey, id: deleting.id });
          if (res?.serverError) return void toast.error(res.serverError.message);
          toast.success(`Deleted ${deleting.title}`);
          setDeleting(null);
        }}
      />
    </section>
  );
}

function RecurringDialog({
  slug,
  projectKey,
  row,
  people,
  onClose,
}: {
  slug: string;
  projectKey: string;
  row?: RecurringRow;
  people: People;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(row?.title ?? "");
  const [description, setDescription] = useState(row?.description ?? "");
  const [type, setType] = useState<(typeof TYPES)[number]>(
    (row?.type as (typeof TYPES)[number]) ?? "task",
  );
  const [priority, setPriority] = useState<Priority>(row?.priority ?? "medium");
  const [assigneeId, setAssigneeId] = useState(row?.assigneeId ?? "none");
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(row?.frequency ?? "weekly");
  const [weekdays, setWeekdays] = useState<string[]>(
    row?.frequency === "weekly" ? row.days.map(String) : ["1"],
  );
  const [monthDay, setMonthDay] = useState(
    row?.frequency === "monthly" ? String(row.days[0] ?? 1) : "1",
  );
  const [dueInDays, setDueInDays] = useState(
    row?.dueInDays === null || row?.dueInDays === undefined ? "" : String(row.dueInDays),
  );
  const save = useAction(saveRecurringAction);
  const error = save.result.serverError;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const res = await save.executeAsync({
      slug,
      projectKey,
      id: row?.id ?? null,
      recurring: {
        title,
        description,
        type,
        priority,
        assigneeId: assigneeId === "none" ? null : assigneeId,
        frequency,
        days:
          frequency === "weekly"
            ? weekdays.map(Number)
            : frequency === "monthly"
              ? [Number(monthDay)]
              : [],
        dueInDays: dueInDays === "" ? null : Number(dueInDays),
      },
    });
    if (res?.validationErrors) return void toast.error("Check the highlighted fields");
    if (!res?.data) return;
    toast.success(row ? `Saved ${res.data.title}` : `Created ${res.data.title}`);
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{row ? `Edit ${row.title}` : "New recurring issue"}</DialogTitle>
          <DialogDescription>
            Created at 00:00 UTC on each matching day, in the first workflow status.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="rec-title">Title</FieldLabel>
              <Input
                id="rec-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={255}
                autoFocus
                placeholder="Update dependencies"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="rec-desc">Description</FieldLabel>
              <Textarea
                id="rec-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Markdown"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="rec-type">Type</FieldLabel>
                <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                  <SelectTrigger id="rec-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        <IssueTypeIcon type={t} />
                        {ISSUE_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="rec-priority">Priority</FieldLabel>
                <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                  <SelectTrigger id="rec-priority" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[...PRIORITIES].reverse().map((p) => (
                      <SelectItem key={p} value={p}>
                        {PRIORITY_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="rec-assignee">Assignee</FieldLabel>
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger id="rec-assignee" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {people.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="rec-frequency">Repeats</FieldLabel>
                <Select
                  value={frequency}
                  onValueChange={(v) => setFrequency(v as RecurrenceFrequency)}
                >
                  <SelectTrigger id="rec-frequency" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="rec-due">Due after (days)</FieldLabel>
                <Input
                  id="rec-due"
                  type="number"
                  min={0}
                  max={365}
                  value={dueInDays}
                  onChange={(e) => setDueInDays(e.target.value)}
                  placeholder="No due date"
                />
              </Field>
            </div>
            {frequency === "weekly" ? (
              <Field data-invalid={error?.field === "days" || undefined}>
                <FieldLabel>On</FieldLabel>
                <ToggleGroup
                  type="multiple"
                  variant="outline"
                  value={weekdays}
                  onValueChange={setWeekdays}
                  className="flex-wrap"
                >
                  {WEEKDAYS.map((d, i) => (
                    <ToggleGroupItem key={d} value={String(i + 1)} aria-label={d}>
                      {d}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                {error?.field === "days" ? <FieldError>{error.message}</FieldError> : null}
              </Field>
            ) : null}
            {frequency === "monthly" ? (
              <Field>
                <FieldLabel htmlFor="rec-day">Day of month</FieldLabel>
                <Input
                  id="rec-day"
                  type="number"
                  min={1}
                  max={31}
                  value={monthDay}
                  onChange={(e) => setMonthDay(e.target.value)}
                  className="w-24"
                />
                <FieldDescription>
                  Short months use their last day (31 means &ldquo;last day&rdquo;).
                </FieldDescription>
              </Field>
            ) : null}
            {error && error.field !== "days" ? <FieldError>{error.message}</FieldError> : null}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || save.isPending}>
              {save.isPending ? <Spinner /> : null}
              {row ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
