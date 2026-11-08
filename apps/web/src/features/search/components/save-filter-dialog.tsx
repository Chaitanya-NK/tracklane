"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
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
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createFilterAction, updateFilterAction } from "../server/actions";
import type { FilterSummary } from "../types";

/** Save the current query as a new filter, or rename/edit an existing one. */
export function SaveFilterDialog({
  slug,
  query,
  filter,
  open,
  onOpenChange,
}: {
  slug: string;
  query: string;
  filter?: FilterSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(filter?.name ?? "");
  const [description, setDescription] = useState(filter?.description ?? "");
  const [shared, setShared] = useState(filter?.shared ?? false);
  const create = useAction(createFilterAction);
  const edit = useAction(updateFilterAction);
  const pending = create.isPending || edit.isPending;
  const error = (create.result.serverError ?? edit.result.serverError)?.message;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    const fields = { slug, name, description, query, shared };
    const res = filter
      ? await edit.executeAsync({ ...fields, filterId: filter.id })
      : await create.executeAsync(fields);
    if (!res?.data) return;
    toast.success(filter ? "Filter saved" : `Saved “${res.data.name}”`);
    onOpenChange(false);
    if (!filter) router.push(`/${slug}/filters?filter=${res.data.id}` as Route);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{filter ? "Edit filter" : "Save filter"}</DialogTitle>
          <DialogDescription className="font-mono text-xs break-all">
            {query || "All issues"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="filter-name">Name</FieldLabel>
              <Input
                id="filter-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="filter-description">Description</FieldLabel>
              <Textarea
                id="filter-description"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
              />
            </Field>
            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor="filter-shared">Share with the workspace</FieldLabel>
                <FieldDescription>
                  Everyone in the workspace can see and star it. Only you can edit it.
                </FieldDescription>
              </FieldContent>
              <Switch id="filter-shared" checked={shared} onCheckedChange={setShared} />
            </Field>
            {error ? <FieldError>{error}</FieldError> : null}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || pending}>
              {pending ? <Spinner /> : null}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
