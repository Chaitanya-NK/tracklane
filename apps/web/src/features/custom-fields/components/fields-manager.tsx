"use client";

import {
  CUSTOM_FIELD_TYPE_LABELS,
  CUSTOM_FIELD_TYPES,
  type CustomFieldType,
  LABEL_COLORS,
  type LabelColor,
} from "@tracklane/core";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ListPlusIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LABEL_SWATCH, LabelBadge } from "@/features/issues";
import { cn } from "@/lib/utils";
import {
  createFieldAction,
  deleteFieldAction,
  reorderFieldsAction,
  updateFieldAction,
} from "../server/actions";
import type { CustomFieldDef } from "../types";

const quoteTql = (name: string) => `"${name.replace(/"/g, '\\"')}"`;

export function FieldsManager({
  slug,
  projectKey,
  fields,
  canEdit,
}: {
  slug: string;
  projectKey: string;
  fields: CustomFieldDef[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<CustomFieldDef | "new" | null>(null);
  const [deleting, setDeleting] = useState<CustomFieldDef | null>(null);
  const remove = useAction(deleteFieldAction);
  const reorder = useAction(reorderFieldsAction);

  async function move(index: number, by: -1 | 1) {
    const ids = fields.map((f) => f.id);
    const [id] = ids.splice(index, 1);
    ids.splice(index + by, 0, id!);
    const res = await reorder.executeAsync({ slug, projectKey, fieldIds: ids });
    if (res?.serverError) toast.error(res.serverError.message);
  }

  async function confirmDelete() {
    if (!deleting) return;
    const res = await remove.executeAsync({ slug, projectKey, fieldId: deleting.id });
    if (res?.serverError) return void toast.error(res.serverError.message);
    toast.success(`Deleted ${deleting.name}`);
    setDeleting(null);
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Custom fields</h2>
          <p className="text-sm text-muted-foreground">
            Extra details every issue in this project can carry. They show in the issue panel, the
            create dialog and TQL — e.g.{" "}
            <code className="font-mono">&quot;Team&quot; = Growth</code>.
          </p>
        </div>
        {canEdit ? (
          <Button onClick={() => setEditing("new")}>
            <PlusIcon />
            Add field
          </Button>
        ) : null}
      </div>

      {fields.length === 0 ? (
        <EmptyState
          icon={ListPlusIcon}
          title="No custom fields"
          description={
            canEdit
              ? "Add fields like Team, Customer or Release to track what matters to this project."
              : "Project admins can add fields here."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Field</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Issues</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, index) => (
                <TableRow key={field.id}>
                  <TableCell className="whitespace-normal">
                    <div className="flex items-center gap-2 font-medium">
                      {field.name}
                      {field.required ? <Badge variant="outline">Required</Badge> : null}
                    </div>
                    {field.description ? (
                      <div className="text-xs text-muted-foreground">{field.description}</div>
                    ) : null}
                    {field.options.length ? (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {field.options.slice(0, 8).map((o) => (
                          <LabelBadge key={o.id} label={{ name: o.value, color: o.color }} />
                        ))}
                        {field.options.length > 8 ? (
                          <span className="text-xs text-muted-foreground">
                            +{field.options.length - 8}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {CUSTOM_FIELD_TYPE_LABELS[field.type].label}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{field.usage}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Actions for ${field.name}`}
                        >
                          <MoreHorizontalIcon />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link
                            href={
                              `/${slug}/filters?q=${encodeURIComponent(`project = ${projectKey} AND ${quoteTql(field.name)} IS NOT EMPTY`)}` as Route
                            }
                          >
                            <SearchIcon />
                            Find issues with a value
                          </Link>
                        </DropdownMenuItem>
                        {canEdit ? (
                          <>
                            <DropdownMenuItem onSelect={() => setEditing(field)}>
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={index === 0}
                              onSelect={() => move(index, -1)}
                            >
                              <ArrowUpIcon />
                              Move up
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={index === fields.length - 1}
                              onSelect={() => move(index, 1)}
                            >
                              <ArrowDownIcon />
                              Move down
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setDeleting(field)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {editing ? (
        <FieldDialog
          key={editing === "new" ? "new" : editing.id}
          slug={slug}
          projectKey={projectKey}
          field={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description={
          deleting?.usage
            ? `Its values on ${deleting.usage} issue${deleting.usage === 1 ? "" : "s"} are deleted too. Saved filters using it will show an error.`
            : "No issue has a value for it yet."
        }
        pending={remove.isPending}
        onConfirm={confirmDelete}
      />
    </section>
  );
}

interface OptionDraft {
  id?: string;
  key: string;
  value: string;
  color: LabelColor;
}

let optionKey = 0;
const newOption = (index: number): OptionDraft => ({
  key: `new-${++optionKey}`,
  value: "",
  color: LABEL_COLORS[(index + 6) % LABEL_COLORS.length]!,
});

function FieldDialog({
  slug,
  projectKey,
  field,
  onClose,
}: {
  slug: string;
  projectKey: string;
  field?: CustomFieldDef;
  onClose: () => void;
}) {
  const [name, setName] = useState(field?.name ?? "");
  const [description, setDescription] = useState(field?.description ?? "");
  const [type, setType] = useState<CustomFieldType>(field?.type ?? "text");
  const [required, setRequired] = useState(field?.required ?? false);
  const [options, setOptions] = useState<OptionDraft[]>(() =>
    field?.options.length
      ? field.options.map((o) => ({
          id: o.id,
          key: o.id,
          value: o.value,
          color: o.color as LabelColor,
        }))
      : [newOption(0), newOption(1)],
  );
  const create = useAction(createFieldAction);
  const update = useAction(updateFieldAction);
  const pending = create.isPending || update.isPending;
  const error = (field ? update : create).result.serverError?.message;
  const withOptions = type === "select" || type === "multiselect";

  const setOption = (key: string, patch: Partial<OptionDraft>) =>
    setOptions((list) => list.map((o) => (o.key === key ? { ...o, ...patch } : o)));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const payload = {
      slug,
      projectKey,
      name,
      description,
      required,
      options: withOptions
        ? options
            .filter((o) => o.value.trim())
            .map(({ id, value, color }) => ({ id, value, color }))
        : [],
    };
    const res = field
      ? await update.executeAsync({ ...payload, fieldId: field.id })
      : await create.executeAsync({ ...payload, type });
    if (!res?.data) return;
    toast.success(field ? `Saved ${res.data.name}` : `Added ${res.data.name}`);
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{field ? `Edit ${field.name}` : "Add custom field"}</DialogTitle>
          <DialogDescription>
            {field
              ? "The type can't change once issues may have values."
              : "Fields belong to this project. Use the same name in other projects to search them together."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="field-name">Name</FieldLabel>
              <Input
                id="field-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="field-type">Type</FieldLabel>
              <Select
                value={type}
                onValueChange={(v) => setType(v as CustomFieldType)}
                disabled={Boolean(field)}
              >
                <SelectTrigger id="field-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CUSTOM_FIELD_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {CUSTOM_FIELD_TYPE_LABELS[t].label}
                      <span className="text-muted-foreground">
                        {" "}
                        — {CUSTOM_FIELD_TYPE_LABELS[t].description}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="field-description">Description</FieldLabel>
              <Input
                id="field-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={300}
                placeholder="Optional help text"
              />
            </Field>
            {withOptions ? (
              <FieldSet>
                <FieldLegend variant="label">Options</FieldLegend>
                <ul className="space-y-2">
                  {options.map((o, i) => (
                    <li key={o.key} className="flex items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label={`Colour for option ${i + 1}`}
                          >
                            <span className={cn("size-4 rounded-full", LABEL_SWATCH[o.color])} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuRadioGroup
                            value={o.color}
                            onValueChange={(c) => setOption(o.key, { color: c as LabelColor })}
                          >
                            {LABEL_COLORS.map((c) => (
                              <DropdownMenuRadioItem key={c} value={c} className="capitalize">
                                <span className={cn("size-3 rounded-full", LABEL_SWATCH[c])} /> {c}
                              </DropdownMenuRadioItem>
                            ))}
                          </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Input
                        value={o.value}
                        onChange={(e) => setOption(o.key, { value: e.target.value })}
                        placeholder={`Option ${i + 1}`}
                        maxLength={60}
                        aria-label={`Option ${i + 1}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove option ${i + 1}`}
                        disabled={options.length === 1}
                        onClick={() => setOptions((list) => list.filter((x) => x.key !== o.key))}
                      >
                        <XIcon />
                      </Button>
                    </li>
                  ))}
                </ul>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() => setOptions((list) => [...list, newOption(list.length)])}
                >
                  <PlusIcon />
                  Add option
                </Button>
                {field ? (
                  <FieldDescription>
                    Renaming an option keeps it on issues. Removing one clears it from issues.
                  </FieldDescription>
                ) : null}
              </FieldSet>
            ) : null}
            {type !== "checkbox" ? (
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel htmlFor="field-required">Required</FieldLabel>
                  <FieldDescription>
                    New issues must fill it in, and it can&apos;t be cleared.
                  </FieldDescription>
                </FieldContent>
                <Switch id="field-required" checked={required} onCheckedChange={setRequired} />
              </Field>
            ) : null}
            {error ? <FieldError>{error}</FieldError> : null}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || pending}>
              {pending ? <Spinner /> : null}
              {field ? "Save" : "Add field"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
