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
import { createRetroAction } from "../server/actions";
import { RETRO_TEMPLATES, type RetroTemplate } from "../templates";

export interface RetroProjectOption {
  id: string;
  name: string;
  sprints: { id: string; name: string; state: string }[];
}

export function NewRetroButton({
  slug,
  projects,
}: {
  slug: string;
  projects: RetroProjectOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const project = projects.find((p) => p.id === projectId);
  const defaultSprint = project?.sprints.find((s) => s.state !== "planned") ?? project?.sprints[0];
  const [sprintId, setSprintId] = useState(defaultSprint?.id ?? "none");
  const [name, setName] = useState(defaultSprint ? `${defaultSprint.name} retro` : "");
  const [template, setTemplate] = useState<RetroTemplate>("classic");
  const [votes, setVotes] = useState("5");
  const create = useAction(createRetroAction);

  function pickProject(id: string) {
    setProjectId(id);
    const p = projects.find((x) => x.id === id);
    const s = p?.sprints.find((x) => x.state !== "planned") ?? p?.sprints[0];
    setSprintId(s?.id ?? "none");
    if (s) setName(`${s.name} retro`);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const res = await create.executeAsync({
      slug,
      projectId,
      sprintId: sprintId === "none" ? null : sprintId,
      name,
      template,
      votesPerPerson: Number(votes) || 5,
    });
    if (!res?.data) return;
    setOpen(false);
    router.push(`/${slug}/retros/${res.data.id}` as Route);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={!projects.length}>
        <PlusIcon />
        New retro
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New retrospective</DialogTitle>
            <DialogDescription>
              You&apos;ll facilitate it: move it from brainstorm to voting to discussion.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit}>
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="retro-project">Project</FieldLabel>
                  <Select value={projectId} onValueChange={pickProject}>
                    <SelectTrigger id="retro-project" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="retro-sprint">Sprint</FieldLabel>
                  <Select value={sprintId} onValueChange={setSprintId}>
                    <SelectTrigger id="retro-sprint" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No sprint</SelectItem>
                      {project?.sprints.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="retro-name">Name</FieldLabel>
                <Input
                  id="retro-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                  placeholder="Sprint 12 retro"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
                <Field>
                  <FieldLabel htmlFor="retro-template">Format</FieldLabel>
                  <Select value={template} onValueChange={(v) => setTemplate(v as RetroTemplate)}>
                    <SelectTrigger id="retro-template" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(RETRO_TEMPLATES) as RetroTemplate[]).map((t) => (
                        <SelectItem key={t} value={t}>
                          {RETRO_TEMPLATES[t].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="retro-votes">Votes each</FieldLabel>
                  <Input
                    id="retro-votes"
                    type="number"
                    min={1}
                    max={20}
                    value={votes}
                    onChange={(e) => setVotes(e.target.value)}
                  />
                </Field>
              </div>
              {create.result.serverError ? (
                <FieldError>{create.result.serverError.message}</FieldError>
              ) : null}
            </FieldGroup>
            <DialogFooter className="mt-6">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim() || !projectId || create.isPending}>
                {create.isPending ? <Spinner /> : null}
                Start retro
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
