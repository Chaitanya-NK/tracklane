"use client";

import { MoreHorizontalIcon, PackageIcon, PlusIcon, RocketIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DatePicker } from "@/components/shared/date-picker";
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
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";
import {
  deleteReleaseAction,
  saveReleaseAction,
  setReleaseStatusAction,
  shipReleaseAction,
} from "../server/actions";
import { ReleaseProgress } from "./release-progress";

export interface ReleaseRow {
  id: string;
  name: string;
  description: string;
  status: "unreleased" | "released" | "archived";
  startDate: string | null;
  releaseDate: string | null;
  releasedAt: Date | null;
  counts: { todo: number; in_progress: number; done: number };
}

export const RELEASE_STATUS_LABELS = {
  unreleased: "Unreleased",
  released: "Released",
  archived: "Archived",
};

export function ReleasesManager({
  slug,
  projectKey,
  releases,
  showArchived,
  canEdit,
  today,
}: {
  slug: string;
  projectKey: string;
  releases: ReleaseRow[];
  showArchived: boolean;
  canEdit: boolean;
  /** YYYY-MM-DD, for flagging overdue releases. */
  today: string;
}) {
  const [editing, setEditing] = useState<ReleaseRow | "new" | null>(null);
  const [shipping, setShipping] = useState<ReleaseRow | null>(null);
  const [deleting, setDeleting] = useState<ReleaseRow | null>(null);
  const setStatus = useAction(setReleaseStatusAction);
  const remove = useAction(deleteReleaseAction);
  const base = `/${slug}/projects/${projectKey}/releases`;

  async function changeStatus(row: ReleaseRow, status: ReleaseRow["status"]) {
    const res = await setStatus.executeAsync({ slug, projectKey, releaseId: row.id, status });
    if (res?.serverError) toast.error(res.serverError.message);
    else toast.success(`${row.name} is ${RELEASE_STATUS_LABELS[status].toLowerCase()}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Versions you ship. Set an issue&apos;s fix version in its details, then release the
          version when it&apos;s out.
        </p>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href={(showArchived ? base : `${base}?archived=1`) as Route}>
              {showArchived ? "Hide archived" : "Show archived"}
            </Link>
          </Button>
          {canEdit ? (
            <Button onClick={() => setEditing("new")}>
              <PlusIcon />
              New release
            </Button>
          ) : null}
        </div>
      </div>
      {releases.length === 0 ? (
        <EmptyState
          icon={PackageIcon}
          title="No releases yet"
          description="Create a version like 1.0 and add issues to it."
        />
      ) : (
        <ul className="divide-y rounded-lg border">
          {releases.map((row) => {
            const total = row.counts.todo + row.counts.in_progress + row.counts.done;
            const overdue =
              row.status === "unreleased" && row.releaseDate !== null && row.releaseDate < today;
            return (
              <li
                key={row.id}
                className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_14rem_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`${base}/${row.id}` as Route}
                      className="font-medium hover:underline"
                    >
                      {row.name}
                    </Link>
                    <Badge variant={row.status === "released" ? "secondary" : "outline"}>
                      {RELEASE_STATUS_LABELS[row.status]}
                    </Badge>
                    {overdue ? <Badge variant="destructive">Overdue</Badge> : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {row.releasedAt
                      ? `Released ${formatDate(row.releasedAt)}`
                      : row.releaseDate
                        ? `Due ${formatDate(row.releaseDate)}`
                        : "No release date"}
                    {row.description ? ` · ${row.description.split("\n")[0]}` : ""}
                  </p>
                </div>
                <ReleaseProgress counts={row.counts} total={total} />
                {canEdit ? (
                  <div className="flex items-center justify-end gap-1">
                    {row.status === "unreleased" ? (
                      <Button size="sm" variant="outline" onClick={() => setShipping(row)}>
                        <RocketIcon />
                        Release
                      </Button>
                    ) : null}
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
                        {row.status === "released" ? (
                          <DropdownMenuItem onSelect={() => changeStatus(row, "unreleased")}>
                            Unrelease
                          </DropdownMenuItem>
                        ) : null}
                        {row.status !== "archived" ? (
                          <DropdownMenuItem onSelect={() => changeStatus(row, "archived")}>
                            Archive
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onSelect={() =>
                              changeStatus(row, row.releasedAt ? "released" : "unreleased")
                            }
                          >
                            Restore
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(row)}>
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {editing ? (
        <ReleaseDialog
          key={editing === "new" ? "new" : editing.id}
          slug={slug}
          projectKey={projectKey}
          row={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {shipping ? (
        <ShipDialog
          slug={slug}
          projectKey={projectKey}
          row={shipping}
          others={releases.filter((r) => r.status === "unreleased" && r.id !== shipping.id)}
          onClose={() => setShipping(null)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="Its issues are kept and lose this fix version. To keep the history, archive it instead."
        pending={remove.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          const res = await remove.executeAsync({ slug, projectKey, releaseId: deleting.id });
          if (res?.serverError) return void toast.error(res.serverError.message);
          toast.success(`Deleted ${deleting.name}`);
          setDeleting(null);
        }}
      />
    </div>
  );
}

export function ReleaseDialog({
  slug,
  projectKey,
  row,
  onClose,
}: {
  slug: string;
  projectKey: string;
  row?: Pick<ReleaseRow, "id" | "name" | "description" | "startDate" | "releaseDate">;
  onClose: () => void;
}) {
  const [name, setName] = useState(row?.name ?? "");
  const [description, setDescription] = useState(row?.description ?? "");
  const [startDate, setStartDate] = useState<string | null>(row?.startDate ?? null);
  const [releaseDate, setReleaseDate] = useState<string | null>(row?.releaseDate ?? null);
  const save = useAction(saveReleaseAction);
  const error = save.result.serverError;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const res = await save.executeAsync({
      slug,
      projectKey,
      releaseId: row?.id ?? null,
      release: { name, description, startDate, releaseDate },
    });
    if (!res?.data) return;
    toast.success(row ? `Saved ${res.data.name}` : `Created ${res.data.name}`);
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{row ? `Edit ${row.name}` : "New release"}</DialogTitle>
          <DialogDescription>
            A version of the product, like 2.4 or &ldquo;Spring launch&rdquo;.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field data-invalid={error?.field === "name" || undefined}>
              <FieldLabel htmlFor="rel-name">Name</FieldLabel>
              <Input
                id="rel-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                autoFocus
                placeholder="1.0"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="rel-start">Start date</FieldLabel>
                <DatePicker
                  id="rel-start"
                  value={startDate}
                  onChange={setStartDate}
                  placeholder="Optional"
                />
              </Field>
              <Field data-invalid={error?.field === "releaseDate" || undefined}>
                <FieldLabel htmlFor="rel-date">Release date</FieldLabel>
                <DatePicker
                  id="rel-date"
                  value={releaseDate}
                  onChange={setReleaseDate}
                  placeholder="Optional"
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="rel-desc">Description</FieldLabel>
              <Textarea
                id="rel-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Shown at the top of the release notes (Markdown)"
              />
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

export function ShipDialog({
  slug,
  projectKey,
  row,
  others,
  onClose,
}: {
  slug: string;
  projectKey: string;
  row: Pick<ReleaseRow, "id" | "name" | "counts">;
  others: Pick<ReleaseRow, "id" | "name">[];
  onClose: () => void;
}) {
  const open = row.counts.todo + row.counts.in_progress;
  const [target, setTarget] = useState(others[0]?.id ?? "none");
  const ship = useAction(shipReleaseAction);

  async function confirm() {
    const res = await ship.executeAsync({
      slug,
      projectKey,
      releaseId: row.id,
      moveOpenTo: open && target !== "none" ? target : null,
    });
    if (res?.serverError) return void toast.error(res.serverError.message);
    if (!res?.data) return;
    toast.success(
      res.data.moved
        ? `Released ${row.name} and moved ${res.data.moved} open ${res.data.moved === 1 ? "issue" : "issues"}`
        : `Released ${row.name}`,
    );
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Release {row.name}</DialogTitle>
          <DialogDescription>
            {open
              ? `${open} ${open === 1 ? "issue isn't" : "issues aren't"} done yet. Where should ${open === 1 ? "it" : "they"} go?`
              : "Every issue in it is done."}
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <Field>
            <FieldLabel htmlFor="ship-target">Move open issues to</FieldLabel>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger id="ship-target" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {others.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
                <SelectItem value="none">No fix version</SelectItem>
              </SelectContent>
            </Select>
            <FieldDescription>Their release notes entry moves with them.</FieldDescription>
          </Field>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={ship.isPending}>
            {ship.isPending ? <Spinner /> : <RocketIcon />}
            Release
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
