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
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ROLE_LABELS,
  STATUS_CATEGORIES,
  STATUS_CATEGORY_LABELS,
  type StatusCategory,
  type TransitionRule,
  type WorkspaceRole,
} from "@tracklane/core";
import {
  CheckIcon,
  GripVerticalIcon,
  MinusIcon,
  MoreHorizontalIcon,
  PlusIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
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
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusBadge } from "@/features/issues";
import { cn } from "@/lib/utils";
import {
  createStatusAction,
  deleteStatusAction,
  reorderStatusesAction,
  setBacklogStatusAction,
  setRestrictTransitionsAction,
  setTransitionAction,
  updateStatusAction,
} from "../server/actions";

export interface WorkflowStatusItem {
  id: string;
  name: string;
  category: StatusCategory;
  issueCount: number;
}

interface Props {
  slug: string;
  projectKey: string;
  projectType: "scrum" | "kanban";
  statuses: WorkflowStatusItem[];
  restrict: boolean;
  transitions: TransitionRule[];
  backlogStatusId: string | null;
  canEdit: boolean;
}

const APPROVER_ROLES: WorkspaceRole[] = ["member", "admin", "owner"];

export function WorkflowEditor(props: Props) {
  return (
    <div className="space-y-10">
      <StatusList {...props} />
      {props.projectType === "kanban" ? <BacklogStatusPicker {...props} /> : null}
      <TransitionGrid {...props} />
    </div>
  );
}

// ── Statuses ────────────────────────────────────────────────────────────────

function StatusList({ slug, projectKey, statuses, canEdit }: Props) {
  const [ordered, setOrdered] = useOptimistic(statuses);
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<WorkflowStatusItem | "new" | null>(null);
  const [deleting, setDeleting] = useState<WorkflowStatusItem | null>(null);
  const reorder = useAction(reorderStatusesAction);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = ordered.findIndex((s) => s.id === active.id);
    const to = ordered.findIndex((s) => s.id === over.id);
    const next = arrayMove(ordered, from, to);
    startTransition(async () => {
      setOrdered(next);
      const res = await reorder.executeAsync({
        slug,
        projectKey,
        statusIds: next.map((s) => s.id),
      });
      if (res?.serverError) toast.error(res.serverError.message);
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Statuses</h2>
          <p className="text-sm text-muted-foreground">
            The board shows one column per status, in this order. The category decides when an issue
            counts as resolved.
          </p>
        </div>
        {canEdit ? (
          <Button variant="outline" onClick={() => setEditing("new")}>
            <PlusIcon />
            Add status
          </Button>
        ) : null}
      </div>
      <DndContext
        id="workflow-statuses"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={ordered.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ul className="divide-y rounded-lg border" aria-label="Statuses">
            {ordered.map((status) => (
              <StatusRow
                key={status.id}
                status={status}
                canEdit={canEdit}
                onEdit={() => setEditing(status)}
                onDelete={() => setDeleting(status)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {editing ? (
        <StatusDialog
          key={editing === "new" ? "new" : editing.id}
          slug={slug}
          projectKey={projectKey}
          status={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {deleting ? (
        <DeleteStatusDialog
          key={deleting.id}
          slug={slug}
          projectKey={projectKey}
          status={deleting}
          others={statuses.filter((s) => s.id !== deleting.id)}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </section>
  );
}

function StatusRow({
  status,
  canEdit,
  onEdit,
  onDelete,
}: {
  status: WorkflowStatusItem;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: status.id,
    disabled: !canEdit,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "flex items-center gap-3 bg-background px-3 py-2.5 first:rounded-t-lg last:rounded-b-lg",
        isDragging && "relative z-10 shadow-md",
      )}
    >
      {canEdit ? (
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
          aria-label={`Reorder ${status.name}`}
          {...attributes}
          {...listeners}
        >
          <GripVerticalIcon className="size-4" />
        </button>
      ) : null}
      <StatusBadge status={status} />
      <span className="text-xs text-muted-foreground">
        {STATUS_CATEGORY_LABELS[status.category]}
      </span>
      <span className="ml-auto text-xs text-muted-foreground tabular-nums">
        {status.issueCount} {status.issueCount === 1 ? "issue" : "issues"}
      </span>
      {canEdit ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={`Actions for ${status.name}`}
            >
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>Edit</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </li>
  );
}

function StatusDialog({
  slug,
  projectKey,
  status,
  onClose,
}: {
  slug: string;
  projectKey: string;
  status?: WorkflowStatusItem;
  onClose: () => void;
}) {
  const [name, setName] = useState(status?.name ?? "");
  const [category, setCategory] = useState<StatusCategory>(status?.category ?? "todo");
  const create = useAction(createStatusAction);
  const update = useAction(updateStatusAction);
  const pending = create.isPending || update.isPending;
  const error = (status ? update : create).result.serverError?.message;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const fields = { slug, projectKey, name, category };
    const res = status
      ? await update.executeAsync({ ...fields, statusId: status.id })
      : await create.executeAsync(fields);
    if (!res?.data) return;
    toast.success(status ? "Status saved" : `Added ${res.data.name}`);
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{status ? `Edit ${status.name}` : "Add status"}</DialogTitle>
          <DialogDescription>
            {status
              ? "Renaming keeps every issue in this status."
              : "New statuses go at the end of the board."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="status-name">Name</FieldLabel>
              <Input
                id="status-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="status-category">Category</FieldLabel>
              <Select value={category} onValueChange={(v) => setCategory(v as StatusCategory)}>
                <SelectTrigger id="status-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {STATUS_CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>Issues in a Done status count as resolved.</FieldDescription>
            </Field>
            {error ? <FieldError>{error}</FieldError> : null}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || pending}>
              {pending ? <Spinner /> : null}
              {status ? "Save" : "Add status"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteStatusDialog({
  slug,
  projectKey,
  status,
  others,
  onClose,
}: {
  slug: string;
  projectKey: string;
  status: WorkflowStatusItem;
  others: WorkflowStatusItem[];
  onClose: () => void;
}) {
  const [target, setTarget] = useState(
    others.find((s) => s.category === status.category)?.id ?? others[0]?.id ?? "",
  );
  const remove = useAction(deleteStatusAction);

  async function confirm() {
    const res = await remove.executeAsync({
      slug,
      projectKey,
      statusId: status.id,
      moveToStatusId: status.issueCount ? target : undefined,
    });
    if (res?.serverError) return void toast.error(res.serverError.message);
    const moved = res?.data?.moved ?? 0;
    const to = others.find((s) => s.id === target)?.name;
    toast.success(
      moved
        ? `Deleted ${status.name} and moved ${moved} issue${moved === 1 ? "" : "s"} to ${to}`
        : `Deleted ${status.name}`,
    );
    onClose();
  }

  if (!others.length) {
    return (
      <ConfirmDialog
        open
        onOpenChange={(open) => !open && onClose()}
        title="Can't delete the last status"
        description="A project needs at least one status. Add another one first."
        confirmLabel="OK"
        destructive={false}
        onConfirm={onClose}
      />
    );
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Delete ${status.name}?`}
      pending={remove.isPending}
      onConfirm={confirm}
      description={
        status.issueCount ? (
          <span className="flex flex-col gap-3">
            <span>
              {status.issueCount} {status.issueCount === 1 ? "issue is" : "issues are"} in this
              status. Move {status.issueCount === 1 ? "it" : "them"} to:
            </span>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger className="w-full" aria-label="Move issues to">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {others.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </span>
        ) : (
          "No issues use this status. Transitions to and from it are removed too."
        )
      }
    />
  );
}

// ── Kanban backlog ──────────────────────────────────────────────────────────

function BacklogStatusPicker({ slug, projectKey, statuses, backlogStatusId, canEdit }: Props) {
  const set = useAction(setBacklogStatusAction);
  const todo = statuses.filter((s) => s.category === "todo");
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Kanban backlog</h2>
        <p className="text-sm text-muted-foreground">
          Issues in the backlog status stay off the board and are listed in the Backlog tab until
          someone pulls them in.
        </p>
      </div>
      <Select
        value={backlogStatusId ?? "none"}
        disabled={!canEdit || set.isPending}
        onValueChange={async (value) => {
          const res = await set.executeAsync({
            slug,
            projectKey,
            statusId: value === "none" ? null : value,
          });
          if (res?.serverError) toast.error(res.serverError.message);
          else toast.success(value === "none" ? "Backlog turned off" : "Backlog status saved");
        }}
      >
        <SelectTrigger className="w-64" aria-label="Backlog status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No backlog — everything is on the board</SelectItem>
          {todo.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </section>
  );
}

// ── Transitions ─────────────────────────────────────────────────────────────

type CellValue = "none" | "allowed" | `approval:${WorkspaceRole}`;

function cellValue(restrict: boolean, rule?: TransitionRule): CellValue {
  if (!rule) return restrict ? "none" : "allowed";
  return rule.requiresApproval ? `approval:${rule.approverRole}` : "allowed";
}

function TransitionGrid({ slug, projectKey, statuses, restrict, transitions, canEdit }: Props) {
  const [optimistic, setOptimistic] = useOptimistic(
    { restrict, transitions },
    (state, patch: Partial<{ restrict: boolean; transitions: TransitionRule[] }>) => ({
      ...state,
      ...patch,
    }),
  );
  const [, startTransition] = useTransition();
  const toggle = useAction(setRestrictTransitionsAction);
  const set = useAction(setTransitionAction);

  function onRestrict(next: boolean) {
    startTransition(async () => {
      setOptimistic({ restrict: next });
      const res = await toggle.executeAsync({ slug, projectKey, restrict: next });
      if (res?.serverError) toast.error(res.serverError.message);
      else
        toast.success(next ? "Transitions are now enforced" : "Any status can move to any other");
    });
  }

  function onCell(from: WorkflowStatusItem, to: WorkflowStatusItem, value: CellValue) {
    const [kind, role] = value.split(":") as ["none" | "allowed" | "approval", WorkspaceRole?];
    // Without enforcement, "allowed" needs no rule at all.
    const allowed = kind === "approval" || (kind === "allowed" && optimistic.restrict);
    const rest = optimistic.transitions.filter(
      (t) => !(t.fromStatusId === from.id && t.toStatusId === to.id),
    );
    const rule: TransitionRule = {
      fromStatusId: from.id,
      toStatusId: to.id,
      requiresApproval: kind === "approval",
      approverRole: role ?? "admin",
    };
    startTransition(async () => {
      setOptimistic({ transitions: allowed ? [...rest, rule] : rest });
      const res = await set.executeAsync({
        slug,
        projectKey,
        fromStatusId: from.id,
        toStatusId: to.id,
        allowed,
        requiresApproval: rule.requiresApproval,
        approverRole: rule.approverRole,
      });
      if (res?.serverError) toast.error(res.serverError.message);
    });
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Transitions</h2>
        <p className="text-sm text-muted-foreground">
          Which status an issue can move to from its current one, and which moves need an approver
          to sign off. People who can approve a move make it directly.
        </p>
      </div>
      <Field orientation="horizontal" className="rounded-lg border p-3">
        <div className="flex-1">
          <FieldLabel htmlFor="restrict-transitions">Only allow the transitions below</FieldLabel>
          <FieldDescription>
            Off: any status can move to any other (approvals still apply). On: moves that
            aren&apos;t allowed are blocked on the board, in pickers and in bulk edits.
          </FieldDescription>
        </div>
        <Switch
          id="restrict-transitions"
          checked={optimistic.restrict}
          onCheckedChange={onRestrict}
          disabled={!canEdit}
        />
      </Field>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Transitions: rows are the current status, columns the new one
          </caption>
          <thead>
            <tr className="border-b bg-muted/40">
              <th
                scope="col"
                className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
              >
                From ↓ / To →
              </th>
              {statuses.map((to) => (
                <th key={to.id} scope="col" className="px-2 py-2 text-center">
                  <StatusBadge status={to} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {statuses.map((from) => (
              <tr key={from.id} className="border-b last:border-0">
                <th scope="row" className="px-3 py-2 text-left">
                  <StatusBadge status={from} />
                </th>
                {statuses.map((to) =>
                  from.id === to.id ? (
                    <td key={to.id} className="bg-muted/30" aria-label="Same status" />
                  ) : (
                    <td key={to.id} className="px-2 py-1 text-center">
                      <TransitionCell
                        from={from}
                        to={to}
                        restrict={optimistic.restrict}
                        value={cellValue(
                          optimistic.restrict,
                          optimistic.transitions.find(
                            (t) => t.fromStatusId === from.id && t.toStatusId === to.id,
                          ),
                        )}
                        disabled={!canEdit}
                        onChange={(value) => onCell(from, to, value)}
                      />
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <CheckIcon className="size-3.5 text-status-done" /> Allowed
        </span>
        <span className="flex items-center gap-1.5">
          <ShieldCheckIcon className="size-3.5 text-amber-600" /> Needs approval
        </span>
        <span className="flex items-center gap-1.5">
          <MinusIcon className="size-3.5" /> Not allowed
        </span>
      </div>
    </section>
  );
}

function TransitionCell({
  from,
  to,
  restrict,
  value,
  disabled,
  onChange,
}: {
  from: WorkflowStatusItem;
  to: WorkflowStatusItem;
  restrict: boolean;
  value: CellValue;
  disabled: boolean;
  onChange: (value: CellValue) => void;
}) {
  const role = value.startsWith("approval:") ? (value.split(":")[1] as WorkspaceRole) : null;
  const label = role
    ? `Needs approval from ${ROLE_LABELS[role].toLowerCase()}s or above`
    : value === "allowed"
      ? "Allowed"
      : "Not allowed";
  const icon = role ? (
    <ShieldCheckIcon className="size-4 text-amber-600" />
  ) : value === "allowed" ? (
    <CheckIcon className="size-4 text-status-done" />
  ) : (
    <MinusIcon className="size-4 text-muted-foreground" />
  );
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild disabled={disabled}>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={`${from.name} to ${to.name}: ${label}`}
            >
              {icon}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          {from.name} → {to.name}: {label}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent>
        <DropdownMenuLabel>
          {from.name} → {to.name}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as CellValue)}>
          <DropdownMenuRadioItem value="allowed">Allowed</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="none" disabled={!restrict}>
            Not allowed{restrict ? "" : " (turn on enforcement)"}
          </DropdownMenuRadioItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Needs approval from
          </DropdownMenuLabel>
          {APPROVER_ROLES.map((r) => (
            <DropdownMenuRadioItem key={r} value={`approval:${r}`}>
              {ROLE_LABELS[r]}s and above
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
