"use client";

import { PlusIcon } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { createDocAction } from "../server/actions";

/** "New page", or "Add sub-page" when `parent` is given (the child lives in the parent's space). */
export function NewDocButton({
  slug,
  projects,
  parent,
  defaultProjectId = null,
  variant = "default",
}: {
  slug: string;
  projects: { id: string; name: string }[];
  parent?: { id: string; title: string };
  defaultProjectId?: string | null;
  variant?: "default" | "outline" | "ghost";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState(defaultProjectId ?? "workspace");
  const create = useAction(createDocAction);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const res = await create.executeAsync({
      slug,
      title,
      projectId: projectId === "workspace" ? null : projectId,
      parentId: parent?.id ?? null,
    });
    if (!res?.data) return;
    setOpen(false);
    router.push(`/${slug}/docs/${res.data.id}?edit=1` as Route);
  }

  return (
    <>
      <Button variant={variant} size={parent ? "sm" : "default"} onClick={() => setOpen(true)}>
        <PlusIcon />
        {parent ? "Sub-page" : "New page"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{parent ? `New page under ${parent.title}` : "New page"}</DialogTitle>
            <DialogDescription>
              Write in Markdown. ```mermaid blocks become diagrams.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="doc-title">Title</FieldLabel>
                <Input
                  id="doc-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  autoFocus
                  placeholder="Architecture overview"
                />
              </Field>
              {parent ? null : (
                <Field>
                  <FieldLabel htmlFor="doc-space">Space</FieldLabel>
                  <Select value={projectId} onValueChange={setProjectId}>
                    <SelectTrigger id="doc-space" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="workspace">Whole workspace</SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>Project pages also show under the project.</FieldDescription>
                </Field>
              )}
              {create.result.serverError ? (
                <FieldError>{create.result.serverError.message}</FieldError>
              ) : null}
            </FieldGroup>
            <DialogFooter className="mt-6">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!title.trim() || create.isPending}>
                {create.isPending ? <Spinner /> : null}
                Create page
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
