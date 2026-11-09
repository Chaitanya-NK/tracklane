"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckCircle2Icon,
  MoreHorizontalIcon,
  PlusIcon,
  StarIcon,
} from "lucide-react";
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
import {
  createResolutionAction,
  deleteResolutionAction,
  reorderResolutionsAction,
  setDefaultResolutionAction,
  updateResolutionAction,
} from "../server/actions";

export interface ResolutionRow {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  issueCount: number;
}

export function ResolutionsManager({
  slug,
  resolutions,
  canManage,
}: {
  slug: string;
  resolutions: ResolutionRow[];
  canManage: boolean;
}) {
  const [editing, setEditing] = useState<ResolutionRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<ResolutionRow | null>(null);
  const makeDefault = useAction(setDefaultResolutionAction);
  const reorder = useAction(reorderResolutionsAction);

  async function move(index: number, by: -1 | 1) {
    const ids = resolutions.map((r) => r.id);
    const [id] = ids.splice(index, 1);
    ids.splice(index + by, 0, id!);
    const res = await reorder.executeAsync({ slug, resolutionIds: ids });
    if (res?.serverError) toast.error(res.serverError.message);
  }

  async function setDefault(r: ResolutionRow) {
    const res = await makeDefault.executeAsync({ slug, resolutionId: r.id });
    if (res?.serverError) toast.error(res.serverError.message);
    else toast.success(`${r.name} is now the default`);
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Resolutions</h2>
          <p className="text-sm text-muted-foreground">
            How an issue was closed. People pick one when they move an issue to a Done status; the
            default is used for board drags and bulk edits. Search with{" "}
            <code className="font-mono">resolution = &quot;Won&apos;t fix&quot;</code>.
          </p>
        </div>
        {canManage ? (
          <Button onClick={() => setEditing("new")}>
            <PlusIcon />
            Add resolution
          </Button>
        ) : null}
      </div>
      {resolutions.length === 0 ? (
        <EmptyState
          icon={CheckCircle2Icon}
          title="No resolutions"
          description="Add one to start tracking how issues close."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Resolution</TableHead>
                <TableHead className="text-right">Issues</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resolutions.map((r, index) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-normal">
                    <div className="flex items-center gap-2 font-medium">
                      {r.name}
                      {r.isDefault ? <Badge variant="secondary">Default</Badge> : null}
                    </div>
                    {r.description ? (
                      <div className="text-xs text-muted-foreground">{r.description}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.issueCount}</TableCell>
                  <TableCell>
                    {canManage ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Actions for ${r.name}`}>
                            <MoreHorizontalIcon />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setEditing(r)}>Edit</DropdownMenuItem>
                          <DropdownMenuItem disabled={r.isDefault} onSelect={() => setDefault(r)}>
                            <StarIcon />
                            Make default
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled={index === 0} onSelect={() => move(index, -1)}>
                            <ArrowUpIcon />
                            Move up
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={index === resolutions.length - 1}
                            onSelect={() => move(index, 1)}
                          >
                            <ArrowDownIcon />
                            Move down
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={resolutions.length === 1}
                            onSelect={() => setDeleting(r)}
                          >
                            Delete
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
        <ResolutionDialog
          key={editing === "new" ? "new" : editing.id}
          slug={slug}
          resolution={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {deleting ? (
        <DeleteResolutionDialog
          key={deleting.id}
          slug={slug}
          resolution={deleting}
          others={resolutions.filter((r) => r.id !== deleting.id)}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </section>
  );
}

function ResolutionDialog({
  slug,
  resolution,
  onClose,
}: {
  slug: string;
  resolution?: ResolutionRow;
  onClose: () => void;
}) {
  const [name, setName] = useState(resolution?.name ?? "");
  const [description, setDescription] = useState(resolution?.description ?? "");
  const create = useAction(createResolutionAction);
  const update = useAction(updateResolutionAction);
  const pending = create.isPending || update.isPending;
  const error = (resolution ? update : create).result.serverError?.message;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const res = resolution
      ? await update.executeAsync({ slug, resolutionId: resolution.id, name, description })
      : await create.executeAsync({ slug, name, description });
    if (!res?.data) return;
    toast.success(resolution ? `Saved ${res.data.name}` : `Added ${res.data.name}`);
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{resolution ? `Edit ${resolution.name}` : "Add resolution"}</DialogTitle>
          <DialogDescription>Renaming keeps it on every issue that uses it.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="resolution-name">Name</FieldLabel>
              <Input
                id="resolution-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="resolution-description">Description</FieldLabel>
              <Input
                id="resolution-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={200}
                placeholder="Shown when picking it"
              />
            </Field>
            {error ? <FieldError>{error}</FieldError> : null}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || pending}>
              {pending ? <Spinner /> : null}
              {resolution ? "Save" : "Add resolution"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteResolutionDialog({
  slug,
  resolution,
  others,
  onClose,
}: {
  slug: string;
  resolution: ResolutionRow;
  others: ResolutionRow[];
  onClose: () => void;
}) {
  const [replacement, setReplacement] = useState(
    others.find((o) => o.isDefault)?.id ?? others[0]?.id ?? "",
  );
  const remove = useAction(deleteResolutionAction);

  async function confirm() {
    const res = await remove.executeAsync({
      slug,
      resolutionId: resolution.id,
      replacementId: replacement,
    });
    if (res?.serverError) return void toast.error(res.serverError.message);
    toast.success(`Deleted ${resolution.name}`);
    onClose();
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Delete ${resolution.name}?`}
      pending={remove.isPending}
      onConfirm={confirm}
      description={
        <span className="flex flex-col gap-3">
          <span>
            {resolution.issueCount
              ? `${resolution.issueCount} resolved issue${resolution.issueCount === 1 ? " uses" : "s use"} it. Change ${resolution.issueCount === 1 ? "it" : "them"} to:`
              : `No issues use it.${resolution.isDefault ? " Pick the new default:" : ""}`}
          </span>
          {resolution.issueCount || resolution.isDefault ? (
            <Select value={replacement} onValueChange={setReplacement}>
              <SelectTrigger className="w-full" aria-label="Replacement resolution">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {others.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </span>
      }
    />
  );
}
