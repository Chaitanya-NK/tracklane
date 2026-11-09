"use client";

import { BoxesIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
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
import { deleteComponentAction, saveComponentAction } from "../server/actions";

export interface ComponentRow {
  id: string;
  name: string;
  description: string;
  lead: { id: string; name: string; image: string | null } | null;
  issueCount: number;
}

function ComponentDialog({
  slug,
  projectKey,
  component,
  people,
  onClose,
}: {
  slug: string;
  projectKey: string;
  component: ComponentRow | null;
  people: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [name, setName] = useState(component?.name ?? "");
  const [description, setDescription] = useState(component?.description ?? "");
  const [leadId, setLeadId] = useState(component?.lead?.id ?? "none");
  const save = useAction(saveComponentAction, {
    onSuccess: () => {
      toast.success(component ? `Saved ${name.trim()}` : `Created ${name.trim()}`);
      onClose();
    },
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            save.execute({
              slug,
              projectKey,
              componentId: component?.id ?? null,
              component: { name, description, leadId: leadId === "none" ? null : leadId },
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>{component ? "Edit component" : "New component"}</DialogTitle>
            <DialogDescription>
              Components group issues by part of the product, like API or Checkout.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="component-name">Name</FieldLabel>
              <Input
                id="component-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                required
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="component-description">Description</FieldLabel>
              <Textarea
                id="component-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                maxLength={500}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="component-lead">Lead</FieldLabel>
              <Select value={leadId} onValueChange={setLeadId}>
                <SelectTrigger id="component-lead">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No lead</SelectItem>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {save.result.serverError ? (
              <FieldError>{save.result.serverError.message}</FieldError>
            ) : null}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending || !name.trim()}>
              {save.isPending ? <Spinner /> : null}
              {component ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Project settings → Components. */
export function ComponentsManager({
  slug,
  projectKey,
  components,
  people,
  canEdit,
}: {
  slug: string;
  projectKey: string;
  components: ComponentRow[];
  people: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<ComponentRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<ComponentRow | null>(null);
  const remove = useAction(deleteComponentAction, {
    onSuccess: () => {
      toast.success("Component deleted");
      setDeleting(null);
    },
    onError: ({ error }) => toast.error(error.serverError?.message ?? "Couldn't delete"),
  });

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Components</h2>
          <p className="text-sm text-muted-foreground">
            Parts of the product issues belong to. Filter and group the issue list by them.
          </p>
        </div>
        {canEdit ? (
          <Button size="sm" onClick={() => setEditing("new")}>
            <PlusIcon aria-hidden="true" /> New component
          </Button>
        ) : null}
      </div>
      {components.length === 0 ? (
        <EmptyState
          icon={BoxesIcon}
          title="No components yet"
          description="Add components like API, Web app or Payments."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Component</TableHead>
                <TableHead className="w-44">Lead</TableHead>
                <TableHead className="w-24 text-right">Issues</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {components.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="max-w-0">
                    <p className="truncate font-medium">{c.name}</p>
                    {c.description ? (
                      <p className="truncate text-xs text-muted-foreground">{c.description}</p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {c.lead ? (
                      <span className="flex items-center gap-2 text-sm">
                        <UserAvatar user={c.lead} />
                        {c.lead.name}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <Link
                      className="hover:underline"
                      href={
                        `/${slug}/filters?${new URLSearchParams({
                          q: `project = ${projectKey} AND component = "${c.name.replace(/"/g, '\\"')}"`,
                        })}` as Route
                      }
                    >
                      {c.issueCount}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {canEdit ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-7">
                            <MoreHorizontalIcon aria-hidden="true" />
                            <span className="sr-only">Actions for {c.name}</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setEditing(c)}>
                            <PencilIcon aria-hidden="true" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(c)}>
                            <Trash2Icon aria-hidden="true" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {editing ? (
        <ComponentDialog
          slug={slug}
          projectKey={projectKey}
          component={editing === "new" ? null : editing}
          people={people}
          onClose={() => setEditing(null)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="Issues keep everything else; they just lose this component."
        pending={remove.isPending}
        onConfirm={() => deleting && remove.execute({ slug, projectKey, componentId: deleting.id })}
      />
    </div>
  );
}
