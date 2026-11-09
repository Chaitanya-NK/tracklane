"use client";

import {
  ISSUE_TYPE_LABELS,
  ISSUE_TYPES,
  type IssueType,
  LABEL_COLORS,
  type LabelColor,
} from "@tracklane/core";
import { MoreHorizontalIcon, PlusIcon, ShapesIcon } from "lucide-react";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CUSTOM_TYPE_ICONS, IssueTypeIcon, LABEL_SWATCH } from "@/features/issues";
import { cn } from "@/lib/utils";
import { deleteIssueTypeAction, saveIssueTypeAction } from "../server/actions";

interface Row {
  id: string;
  name: string;
  baseType: IssueType;
  color: string;
  icon: string;
  issueCount: number;
}

export function IssueTypesManager({
  slug,
  projectKey,
  types,
  canEdit,
}: {
  slug: string;
  projectKey: string;
  types: Row[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const remove = useAction(deleteIssueTypeAction);

  return (
    <section className="max-w-3xl space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Issue types</h2>
          <p className="text-sm text-muted-foreground">
            Your own types, like Spike or Incident. Each behaves like a built-in type on boards, in
            the hierarchy and in reports, and can be searched with{" "}
            <code className="font-mono text-xs">type = &quot;Spike&quot;</code>.
          </p>
        </div>
        {canEdit ? (
          <Button onClick={() => setEditing("new")}>
            <PlusIcon />
            New type
          </Button>
        ) : null}
      </div>
      <ul className="divide-y rounded-lg border">
        {ISSUE_TYPES.map((t) => (
          <li key={t} className="flex items-center gap-3 p-3 text-sm">
            <IssueTypeIcon type={t} tooltip={false} />
            <span className="flex-1 font-medium">{ISSUE_TYPE_LABELS[t]}</span>
            <span className="text-xs text-muted-foreground">Built in</span>
          </li>
        ))}
        {types.map((row) => (
          <li key={row.id} className="flex items-center gap-3 p-3 text-sm">
            <IssueTypeIcon type={row.baseType} custom={row} tooltip={false} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{row.name}</p>
              <p className="text-xs text-muted-foreground">
                Works like {ISSUE_TYPE_LABELS[row.baseType].toLowerCase()} · {row.issueCount}{" "}
                {row.issueCount === 1 ? "issue" : "issues"}
              </p>
            </div>
            {canEdit ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Actions for ${row.name}`}
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
      {types.length === 0 ? (
        <EmptyState
          icon={ShapesIcon}
          title="No custom types yet"
          description="The five built-in types are always available."
        />
      ) : null}
      {editing ? (
        <TypeDialog
          key={editing === "new" ? "new" : editing.id}
          slug={slug}
          projectKey={projectKey}
          row={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description={
          deleting?.issueCount
            ? `Its ${deleting.issueCount} issues become ${ISSUE_TYPE_LABELS[deleting.baseType].toLowerCase()}s.`
            : "No issues use it."
        }
        pending={remove.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          const res = await remove.executeAsync({ slug, projectKey, id: deleting.id });
          if (res?.serverError) return void toast.error(res.serverError.message);
          toast.success(`Deleted ${deleting.name}`);
          setDeleting(null);
        }}
      />
    </section>
  );
}

function TypeDialog({
  slug,
  projectKey,
  row,
  onClose,
}: {
  slug: string;
  projectKey: string;
  row?: Row;
  onClose: () => void;
}) {
  const [name, setName] = useState(row?.name ?? "");
  const [baseType, setBaseType] = useState<IssueType>(row?.baseType ?? "task");
  const [color, setColor] = useState<LabelColor>((row?.color as LabelColor) ?? "teal");
  const [icon, setIcon] = useState(row?.icon ?? "flask");
  const save = useAction(saveIssueTypeAction);
  const error = save.result.serverError;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const res = await save.executeAsync({
      slug,
      projectKey,
      id: row?.id ?? null,
      issueType: { name, baseType, color, icon },
    });
    if (!res?.data) return;
    toast.success(row ? `Saved ${res.data.name}` : `Created ${res.data.name}`);
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{row ? `Edit ${row.name}` : "New issue type"}</DialogTitle>
          <DialogDescription>
            Shown with its own icon and colour wherever issues appear.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <div className="flex items-end gap-3">
              <IssueTypeIcon
                type={baseType}
                custom={{ name, color, icon }}
                className="mb-2.5 size-6"
                tooltip={false}
              />
              <Field data-invalid={error?.field === "name" || undefined} className="flex-1">
                <FieldLabel htmlFor="type-name">Name</FieldLabel>
                <Input
                  id="type-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={40}
                  autoFocus
                  placeholder="Spike"
                />
              </Field>
            </div>
            <Field data-invalid={error?.field === "baseType" || undefined}>
              <FieldLabel htmlFor="type-base">Works like</FieldLabel>
              <Select
                value={baseType}
                onValueChange={(v) => setBaseType(v as IssueType)}
                disabled={Boolean(row)}
              >
                <SelectTrigger id="type-base" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ISSUE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      <IssueTypeIcon type={t} tooltip={false} /> {ISSUE_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                Decides what it can be the parent of. Can&apos;t be changed later.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel>Colour</FieldLabel>
              <ToggleGroup
                type="single"
                value={color}
                onValueChange={(v) => v && setColor(v as LabelColor)}
                className="flex-wrap"
              >
                {LABEL_COLORS.map((c) => (
                  <ToggleGroupItem key={c} value={c} aria-label={c} className="size-8">
                    <span className={cn("size-4 rounded-full", LABEL_SWATCH[c])} />
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
            <Field>
              <FieldLabel>Icon</FieldLabel>
              <ToggleGroup
                type="single"
                value={icon}
                onValueChange={(v) => v && setIcon(v)}
                className="flex-wrap"
              >
                {Object.entries(CUSTOM_TYPE_ICONS).map(([key, Icon]) => (
                  <ToggleGroupItem key={key} value={key} aria-label={key} className="size-8">
                    <Icon />
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
            {error ? <FieldError>{error.message}</FieldError> : null}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || save.isPending}>
              {save.isPending ? <Spinner /> : null}
              {row ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
