"use client";

import { PRIORITIES, PRIORITY_LABELS, type Priority } from "@tracklane/core";
import { ChevronDownIcon, TagIcon, Trash2Icon, XIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { PriorityIcon } from "@/features/issues";
import { bulkDeleteAction, bulkUpdateAction } from "../server/actions";

type Patch = Parameters<typeof bulkUpdateAction>[0]["patch"];

/** Shown when rows are selected: change status, assignee, priority or labels for all of them. */
export function BulkBar({
  slug,
  selectedIds,
  onClear,
  statuses,
  people,
  canDelete,
}: {
  slug: string;
  selectedIds: string[];
  onClear: () => void;
  statuses: string[];
  people: { id: string; name: string; image: string | null }[];
  canDelete: boolean;
}) {
  const [labelOpen, setLabelOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const update = useAction(bulkUpdateAction);
  const remove = useAction(bulkDeleteAction);
  const count = selectedIds.length;
  const pending = update.isPending || remove.isPending;

  async function apply(patch: Patch, what: string) {
    const res = await update.executeAsync({ slug, issueIds: selectedIds, patch });
    if (res?.serverError) return toast.error(res.serverError.message);
    if (!res?.data) return;
    const { updated, skipped } = res.data;
    if (updated) toast.success(`${what} for ${updated} issue${updated === 1 ? "" : "s"}`);
    if (skipped.length) {
      toast.warning(`Skipped ${skipped.length}`, {
        description: skipped
          .slice(0, 4)
          .map((s) => `${s.key}: ${s.reason}`)
          .join("\n"),
      });
    }
    onClear();
  }

  async function deleteAll() {
    const res = await remove.executeAsync({ slug, issueIds: selectedIds });
    if (res?.serverError) return toast.error(res.serverError.message);
    toast.success(`Deleted ${res?.data?.deleted ?? 0} issues`);
    setConfirmDelete(false);
    onClear();
  }

  return (
    <div className="sticky bottom-4 z-20 mx-auto flex w-fit items-center gap-2 rounded-xl border bg-background px-3 py-2 shadow-lg">
      <span className="text-sm font-medium tabular-nums">{count} selected</span>
      <ButtonGroup>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={pending}>
              {pending ? <Spinner /> : null}
              Change <ChevronDownIcon aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="top" className="w-52">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Status</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                {statuses.map((name) => (
                  <DropdownMenuItem
                    key={name}
                    onSelect={() => apply({ statusName: name }, `Status set to ${name}`)}
                  >
                    {name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Assignee</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                <DropdownMenuItem onSelect={() => apply({ assigneeId: null }, "Unassigned")}>
                  Unassigned
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {people.map((person) => (
                  <DropdownMenuItem
                    key={person.id}
                    onSelect={() => apply({ assigneeId: person.id }, `Assigned to ${person.name}`)}
                  >
                    <UserAvatar user={person} className="size-5" /> {person.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Priority</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {[...PRIORITIES].reverse().map((p) => (
                  <DropdownMenuItem
                    key={p}
                    onSelect={() =>
                      apply({ priority: p as Priority }, `Priority set to ${PRIORITY_LABELS[p]}`)
                    }
                  >
                    <PriorityIcon priority={p} tooltip={false} /> {PRIORITY_LABELS[p]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem onSelect={() => setLabelOpen(true)}>
              <TagIcon aria-hidden="true" /> Add label…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {canDelete ? (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2Icon aria-hidden="true" /> Delete
          </Button>
        ) : null}
      </ButtonGroup>
      <Button variant="ghost" size="icon-sm" aria-label="Clear selection" onClick={onClear}>
        <XIcon aria-hidden="true" />
      </Button>

      <Dialog open={labelOpen} onOpenChange={setLabelOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add a label</DialogTitle>
            <DialogDescription>
              Added to {count} issue{count === 1 ? "" : "s"}. Projects without this label get it
              created.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!label.trim()) return;
              void apply({ addLabelName: label.trim() }, `Label "${label.trim()}" added`).then(
                () => {
                  setLabelOpen(false);
                  setLabel("");
                },
              );
            }}
          >
            <Field>
              <FieldLabel htmlFor="bulk-label">Label</FieldLabel>
              <Input
                id="bulk-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={40}
                autoFocus
              />
              <FieldDescription>Existing labels keep their colour.</FieldDescription>
            </Field>
            <DialogFooter className="mt-4">
              <Button type="submit" disabled={!label.trim() || update.isPending}>
                {update.isPending ? <Spinner /> : null}
                Add label
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${count} issue${count === 1 ? "" : "s"}?`}
        description="Their comments, attachments and history are deleted too. This can't be undone."
        pending={remove.isPending}
        onConfirm={deleteAll}
      />
    </div>
  );
}
