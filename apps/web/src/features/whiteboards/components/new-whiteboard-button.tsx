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
import { createWhiteboardAction } from "../server/actions";

export function NewWhiteboardButton({
  slug,
  projects,
}: {
  slug: string;
  projects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("workspace");
  const create = useAction(createWhiteboardAction);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const res = await create.executeAsync({
      slug,
      name,
      projectId: projectId === "workspace" ? null : projectId,
    });
    if (!res?.data) return;
    setOpen(false);
    router.push(`/${slug}/whiteboards/${res.data.id}` as Route);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon />
        New whiteboard
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New whiteboard</DialogTitle>
            <DialogDescription>
              A shared canvas for sketches, flows and workshops. Everyone sees changes live.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="wb-name">Name</FieldLabel>
                <Input
                  id="wb-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                  autoFocus
                  placeholder="Checkout flow sketch"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="wb-space">Project</FieldLabel>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger id="wb-space" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="workspace">None (workspace)</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {create.result.serverError ? (
                <FieldError>{create.result.serverError.message}</FieldError>
              ) : null}
            </FieldGroup>
            <DialogFooter className="mt-6">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim() || create.isPending}>
                {create.isPending ? <Spinner /> : null}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
