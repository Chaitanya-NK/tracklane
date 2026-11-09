"use client";

import {
  type TqlCatalog,
  TQL_VALUE_KIND_LABELS,
  TQL_VALUE_KINDS,
  type TqlValueKind,
} from "@tracklane/core";
import { BracesIcon, MoreHorizontalIcon, PlusIcon, SearchIcon } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  createTqlFunctionAction,
  deleteTqlFunctionAction,
  updateTqlFunctionAction,
} from "../server/actions";
import { TqlEditor } from "./tql-editor";

export interface TqlFunctionRow {
  id: string;
  name: string;
  description: string;
  kind: "condition" | "values";
  body: string;
  valueKind: string | null;
  values: string[];
  createdByName: string | null;
}

/** Example values per kind, from the workspace, so the hint is something that works. */
function valueHint(kind: TqlValueKind, catalog: TqlCatalog) {
  const sample = {
    user: catalog.users.map((u) => u.email),
    label: catalog.labels,
    project: catalog.projects.map((p) => p.key),
    status: catalog.statuses,
    sprint: catalog.sprints,
    release: catalog.releases ?? [],
  }[kind].slice(0, 3);
  const unit = kind === "user" ? "email or name" : kind === "project" ? "project key" : kind;
  return `One ${unit} per line${sample.length ? `, e.g. ${sample.join(", ")}` : ""}.`;
}

function usage(fn: Pick<TqlFunctionRow, "name" | "kind" | "valueKind">) {
  if (fn.kind === "condition") return `${fn.name}()`;
  const field = {
    user: "assignee",
    label: "labels",
    project: "project",
    status: "status",
    sprint: "sprint",
    release: "release",
  }[fn.valueKind as TqlValueKind];
  return `${field ?? "field"} in ${fn.name}()`;
}

export function TqlFunctionsManager({
  slug,
  functions,
  catalog,
  canManage,
}: {
  slug: string;
  functions: TqlFunctionRow[];
  catalog: TqlCatalog;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState<TqlFunctionRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<TqlFunctionRow | null>(null);
  const remove = useAction(deleteTqlFunctionAction);

  async function confirmDelete() {
    if (!deleting) return;
    const res = await remove.executeAsync({ slug, functionId: deleting.id });
    if (res?.serverError) return void toast.error(res.serverError.message);
    toast.success(`Deleted ${deleting.name}()`);
    setDeleting(null);
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">TQL functions</h2>
          <p className="text-sm text-muted-foreground">
            Reusable pieces of TQL everyone in the workspace can use in searches and saved filters.
          </p>
        </div>
        {canManage ? (
          <Button onClick={() => setEditing("new")}>
            <PlusIcon />
            New function
          </Button>
        ) : null}
      </div>

      {functions.length === 0 ? (
        <EmptyState
          icon={BracesIcon}
          title="No functions yet"
          description={
            canManage
              ? "Name a condition you write often, like isStale(), or a list of values, like frontendTeam()."
              : "Admins can define functions for the workspace here."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Function</TableHead>
                <TableHead>Definition</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {functions.map((fn) => (
                <TableRow key={fn.id}>
                  <TableCell className="align-top">
                    <div className="font-mono text-sm font-medium">{fn.name}()</div>
                    {fn.description ? (
                      <div className="mt-1 max-w-64 text-xs whitespace-normal text-muted-foreground">
                        {fn.description}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="align-top whitespace-normal">
                    <Badge variant="secondary" className="mb-1.5">
                      {fn.kind === "condition"
                        ? "Condition"
                        : `List of ${fn.valueKind === "user" ? "people" : `${fn.valueKind}s`}`}
                    </Badge>
                    <div className="font-mono text-xs break-all text-muted-foreground">
                      {fn.kind === "condition" ? fn.body : fn.values.join(", ")}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Actions for ${fn.name}()`}>
                          <MoreHorizontalIcon />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/${slug}/filters?q=${encodeURIComponent(usage(fn))}` as Route}
                          >
                            <SearchIcon />
                            Try in search
                          </Link>
                        </DropdownMenuItem>
                        {canManage ? (
                          <>
                            <DropdownMenuItem onSelect={() => setEditing(fn)}>
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setDeleting(fn)}
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
        <TqlFunctionDialog
          key={editing === "new" ? "new" : editing.id}
          slug={slug}
          fn={editing === "new" ? undefined : editing}
          catalog={catalog}
          onClose={() => setEditing(null)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name}()?`}
        description="Saved filters and searches that use it will show an error until they're updated."
        pending={remove.isPending}
        onConfirm={confirmDelete}
      />
    </section>
  );
}

function TqlFunctionDialog({
  slug,
  fn,
  catalog,
  onClose,
}: {
  slug: string;
  fn?: TqlFunctionRow;
  catalog: TqlCatalog;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<"condition" | "values">(fn?.kind ?? "condition");
  const [name, setName] = useState(fn?.name ?? "");
  const [description, setDescription] = useState(fn?.description ?? "");
  const [body, setBody] = useState(fn?.body ?? "");
  const [valueKind, setValueKind] = useState<TqlValueKind>(
    (fn?.valueKind as TqlValueKind | null) ?? "user",
  );
  const [values, setValues] = useState(fn?.values.join("\n") ?? "");
  const create = useAction(createTqlFunctionAction);
  const update = useAction(updateTqlFunctionAction);
  const pending = create.isPending || update.isPending;
  const serverError = (fn ? update : create).result.serverError;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const payload =
      kind === "condition"
        ? { kind, name: name.trim(), description, body }
        : { kind, name: name.trim(), description, valueKind, values: values.split("\n") };
    const res = fn
      ? await update.executeAsync({ slug, functionId: fn.id, fn: payload })
      : await create.executeAsync({ slug, fn: payload });
    if (!res?.data) return;
    toast.success(fn ? `Saved ${res.data.name}()` : `Created ${res.data.name}()`);
    onClose();
  }

  const fieldError = (field: string) =>
    serverError?.field === field ? <FieldError>{serverError.message}</FieldError> : null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{fn ? `Edit ${fn.name}()` : "New TQL function"}</DialogTitle>
          <DialogDescription>
            {kind === "condition"
              ? "A condition stands for a whole TQL query: write isStale() instead of repeating it."
              : "A value list stands for several values of one field: assignee in frontendTeam()."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel>Type</FieldLabel>
              <ToggleGroup
                type="single"
                variant="outline"
                value={kind}
                onValueChange={(v) => v && setKind(v as typeof kind)}
                className="w-full"
              >
                <ToggleGroupItem value="condition" className="flex-1">
                  Condition
                </ToggleGroupItem>
                <ToggleGroupItem value="values" className="flex-1">
                  Value list
                </ToggleGroupItem>
              </ToggleGroup>
            </Field>
            <Field data-invalid={serverError?.field === "name" || undefined}>
              <FieldLabel htmlFor="fn-name">Name</FieldLabel>
              <Input
                id="fn-name"
                value={name}
                onChange={(e) => setName(e.target.value.replace(/[^A-Za-z0-9_]/g, ""))}
                placeholder={kind === "condition" ? "isStale" : "frontendTeam"}
                maxLength={40}
                className="font-mono"
                autoFocus
              />
              <FieldDescription>
                Used as <code className="font-mono">{name || "name"}()</code>. Letters, digits and
                underscores.
              </FieldDescription>
              {fieldError("name")}
            </Field>
            <Field>
              <FieldLabel htmlFor="fn-description">Description</FieldLabel>
              <Input
                id="fn-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Shown in autocomplete"
                maxLength={300}
              />
            </Field>
            {kind === "condition" ? (
              <Field data-invalid={serverError?.field === "body" || undefined}>
                <FieldLabel>Condition</FieldLabel>
                <TqlEditor value={body} onChange={setBody} onSubmit={() => {}} catalog={catalog} />
                <FieldDescription>
                  Any TQL condition. It can use custom fields, other functions and
                  filter(&quot;Saved filter&quot;). ORDER BY is ignored.
                </FieldDescription>
                {fieldError("body")}
              </Field>
            ) : (
              <>
                <Field>
                  <FieldLabel htmlFor="fn-kind">Values are</FieldLabel>
                  <Select value={valueKind} onValueChange={(v) => setValueKind(v as TqlValueKind)}>
                    <SelectTrigger id="fn-kind" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TQL_VALUE_KINDS.map((k) => (
                        <SelectItem key={k} value={k}>
                          {TQL_VALUE_KIND_LABELS[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field data-invalid={serverError?.field === "values" || undefined}>
                  <FieldLabel htmlFor="fn-values">Values</FieldLabel>
                  <Textarea
                    id="fn-values"
                    rows={5}
                    value={values}
                    onChange={(e) => setValues(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <FieldDescription>{valueHint(valueKind, catalog)}</FieldDescription>
                  {fieldError("values")}
                </Field>
              </>
            )}
            {serverError && !serverError.field ? (
              <FieldError>{serverError.message}</FieldError>
            ) : null}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || pending}>
              {pending ? <Spinner /> : null}
              {fn ? "Save" : "Create function"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
