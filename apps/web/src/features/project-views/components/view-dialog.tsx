"use client";

import { useAction } from "next-safe-action/hooks";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { createViewAction, updateViewSharingAction } from "../server/actions";

export interface ViewSummary {
  id: string;
  name: string;
  params: string;
  groupBy: string;
  columns: string[];
  shared: boolean;
  editable: boolean;
  isDefault: boolean;
  mine: boolean;
  ownerName: string;
}

/**
 * Create a view from the current list state, or rename/share an existing one.
 * Visibility: only me / everyone in the project; others may edit; pin as the team default.
 */
export function ViewDialog({
  slug,
  projectKey,
  view,
  state,
  canSetDefault,
  open,
  onOpenChange,
}: {
  slug: string;
  projectKey: string;
  /** Editing this view's name and sharing; null creates a new view from `state`. */
  view: ViewSummary | null;
  state: { params: string; groupBy: string; columns: string[] };
  canSetDefault: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [name, setName] = useState(view?.name ?? "");
  const [visibility, setVisibility] = useState(view?.shared ? "shared" : "private");
  const [editable, setEditable] = useState(view?.editable ?? false);
  const [isDefault, setIsDefault] = useState(view?.isDefault ?? false);
  const create = useAction(createViewAction);
  const update = useAction(updateViewSharingAction);
  const pending = create.isPending || update.isPending;
  const error = (create.result.serverError ?? update.result.serverError)?.message;
  const shared = visibility === "shared" || isDefault;
  const sharing = { shared, editable: shared && editable, isDefault };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    if (view) {
      const res = await update.executeAsync({
        slug,
        projectKey,
        viewId: view.id,
        name,
        sharing,
      });
      if (res?.serverError) return;
      toast.success("View updated");
      onOpenChange(false);
      return;
    }
    const res = await create.executeAsync({
      slug,
      projectKey,
      view: { name, ...state },
      sharing,
    });
    if (!res?.data) return;
    toast.success(`Saved view "${name.trim()}"`);
    onOpenChange(false);
    const params = new URLSearchParams(state.params);
    params.set("view", res.data.id);
    if (state.groupBy !== "none") params.set("group", state.groupBy);
    params.set("cols", state.columns.join(","));
    router.push(`${pathname}?${params}` as Route);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-6">
          <DialogHeader>
            <DialogTitle>{view ? "View settings" : "Save view"}</DialogTitle>
            <DialogDescription>
              {view
                ? "Rename the view and choose who can see it."
                : "Saves the current filters, grouping, sort and columns as a tab."}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="view-name">Name</FieldLabel>
              <Input
                id="view-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                placeholder="My open bugs"
                autoFocus
                required
              />
            </Field>
            <Field>
              <FieldLabel>Who can see it</FieldLabel>
              <RadioGroup value={visibility} onValueChange={setVisibility} className="gap-2">
                <FieldLabel htmlFor="view-private" className="font-normal">
                  <Field orientation="horizontal">
                    <RadioGroupItem value="private" id="view-private" />
                    <FieldContent>
                      <span className="font-medium">Only me</span>
                      <FieldDescription>A personal tab nobody else sees.</FieldDescription>
                    </FieldContent>
                  </Field>
                </FieldLabel>
                <FieldLabel htmlFor="view-shared" className="font-normal">
                  <Field orientation="horizontal">
                    <RadioGroupItem value="shared" id="view-shared" />
                    <FieldContent>
                      <span className="font-medium">Everyone in the project</span>
                      <FieldDescription>Shows as a tab for all project members.</FieldDescription>
                    </FieldContent>
                  </Field>
                </FieldLabel>
              </RadioGroup>
            </Field>
            {shared ? (
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel htmlFor="view-editable">Let others edit</FieldLabel>
                  <FieldDescription>Anyone who sees it can save changes to it.</FieldDescription>
                </FieldContent>
                <Switch id="view-editable" checked={editable} onCheckedChange={setEditable} />
              </Field>
            ) : null}
            {canSetDefault ? (
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel htmlFor="view-default">Pin as team default</FieldLabel>
                  <FieldDescription>Opens first for everyone visiting the list.</FieldDescription>
                </FieldContent>
                <Switch id="view-default" checked={isDefault} onCheckedChange={setIsDefault} />
              </Field>
            ) : null}
            {error ? <FieldError>{error}</FieldError> : null}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? <Spinner /> : null}
              {view ? "Save" : "Save view"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
