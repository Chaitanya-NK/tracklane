"use client";

import { LABEL_COLORS, type LabelColor } from "@tracklane/core";
import { MoreHorizontalIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LABEL_SWATCH, LabelBadge } from "@/features/issues";
import { cn } from "@/lib/utils";
import { createLabelAction, deleteLabelAction, updateLabelAction } from "../server/actions";

interface LabelItem {
  id: string;
  name: string;
  color: string;
}

function ColorPicker({
  value,
  onChange,
}: {
  value: LabelColor;
  onChange: (color: LabelColor) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      size="sm"
      value={value}
      onValueChange={(v) => v && onChange(v as LabelColor)}
      aria-label="Label colour"
    >
      {LABEL_COLORS.map((c) => (
        <ToggleGroupItem key={c} value={c} aria-label={c} className="size-8 px-0">
          <span className={cn("size-4 rounded-full", LABEL_SWATCH[c])} aria-hidden="true" />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function EditLabelDialog({
  slug,
  label,
  onClose,
}: {
  slug: string;
  label: LabelItem;
  onClose: () => void;
}) {
  const [name, setName] = useState(label.name);
  const [color, setColor] = useState<LabelColor>(label.color as LabelColor);
  const save = useAction(updateLabelAction);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit label</DialogTitle>
          <DialogDescription>Changes apply to every issue with this label.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await save.executeAsync({ slug, labelId: label.id, name, color });
            if (!res?.data) return;
            toast.success(`Label “${res.data.name}” updated`);
            onClose();
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="label-name">Name</FieldLabel>
              <Input
                id="label-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel>Colour</FieldLabel>
              <ColorPicker value={color} onChange={setColor} />
            </Field>
            <Field>
              <FieldLabel>Preview</FieldLabel>
              <div>
                <LabelBadge label={{ name: name || "label", color }} />
              </div>
            </Field>
            {save.result.serverError ? (
              <FieldError>{save.result.serverError.message}</FieldError>
            ) : null}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || save.isPending}>
              {save.isPending ? <Spinner /> : null}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Project labels: add, rename, recolour and delete. */
export function LabelsManager({
  slug,
  projectKey,
  labels,
  canEdit,
  canDelete,
}: {
  slug: string;
  projectKey: string;
  labels: LabelItem[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<LabelColor>("blue");
  const [editing, setEditing] = useState<LabelItem | null>(null);
  const [deleting, setDeleting] = useState<LabelItem | null>(null);
  const create = useAction(createLabelAction, {
    onSuccess: ({ data }) => {
      toast.success(`Added label “${data?.name}”`);
      setName("");
    },
    onError: ({ error }) => toast.error(error.serverError?.message ?? "Couldn't add the label"),
  });
  const remove = useAction(deleteLabelAction);

  return (
    <div className="space-y-4">
      {labels.length ? (
        <ul className="divide-y rounded-md border">
          {labels.map((label) => (
            <li key={label.id} className="flex items-center gap-2 px-3 py-2">
              <LabelBadge label={label} />
              {canEdit ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="ml-auto"
                      aria-label={`${label.name} actions`}
                    >
                      <MoreHorizontalIcon aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditing(label)}>
                      <PencilIcon aria-hidden="true" /> Edit
                    </DropdownMenuItem>
                    {canDelete ? (
                      <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(label)}>
                        <Trash2Icon aria-hidden="true" /> Delete
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No labels yet.</p>
      )}
      {canEdit ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.execute({ slug, projectKey, name, color });
          }}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New label"
            aria-label="Label name"
            maxLength={40}
            className="h-8 w-48"
          />
          <ColorPicker value={color} onChange={setColor} />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={create.isPending || !name.trim()}
          >
            {create.isPending ? <Spinner /> : <PlusIcon aria-hidden="true" />}
            Add label
          </Button>
        </form>
      ) : null}
      {editing ? (
        <EditLabelDialog slug={slug} label={editing} onClose={() => setEditing(null)} />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete the “${deleting?.name}” label?`}
        description="It's removed from every issue that has it. The issues themselves aren't changed otherwise."
        pending={remove.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          const res = await remove.executeAsync({ slug, labelId: deleting.id });
          if (res?.serverError) return toast.error(res.serverError.message);
          if (res?.data) {
            toast.success(
              `Deleted “${res.data.name}”${res.data.used ? ` (removed from ${res.data.used} issue${res.data.used === 1 ? "" : "s"})` : ""}`,
            );
          }
          setDeleting(null);
        }}
      />
    </div>
  );
}
