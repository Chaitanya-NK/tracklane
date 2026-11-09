"use client";

import { PlusIcon } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
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
import { IssueTypeIcon } from "@/features/issues";
import { DECKS, type DeckName } from "../deck";
import { createPokerSessionAction } from "../server/actions";

export interface PokerProjectOption {
  id: string;
  name: string;
  issues: {
    id: string;
    key: string;
    title: string;
    type: "story" | "task" | "bug" | "epic" | "subtask";
  }[];
}

export function NewPokerButton({
  slug,
  projects,
}: {
  slug: string;
  projects: PokerProjectOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const first = projects.find((p) => p.issues.length) ?? projects[0];
  const [projectId, setProjectId] = useState(first?.id ?? "");
  const project = projects.find((p) => p.id === projectId);
  const [picked, setPicked] = useState<string[]>(
    () => first?.issues.slice(0, 8).map((i) => i.id) ?? [],
  );
  const [name, setName] = useState("Estimation session");
  const [deck, setDeck] = useState<DeckName>("fibonacci");
  const create = useAction(createPokerSessionAction);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const res = await create.executeAsync({ slug, projectId, name, deck, issueIds: picked });
    if (!res?.data) return;
    setOpen(false);
    router.push(`/${slug}/poker/${res.data.id}` as Route);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={!projects.length}>
        <PlusIcon />
        New session
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>New planning poker session</DialogTitle>
            <DialogDescription>
              Everyone picks a card in secret; you reveal, discuss and save the estimate.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit}>
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="poker-name">Name</FieldLabel>
                  <Input
                    id="poker-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={120}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="poker-deck">Cards</FieldLabel>
                  <Select value={deck} onValueChange={(v) => setDeck(v as DeckName)}>
                    <SelectTrigger id="poker-deck" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(DECKS) as DeckName[]).map((d) => (
                        <SelectItem key={d} value={d}>
                          {DECKS[d].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="poker-project">Project</FieldLabel>
                <Select
                  value={projectId}
                  onValueChange={(id) => {
                    setProjectId(id);
                    setPicked(
                      projects
                        .find((p) => p.id === id)
                        ?.issues.slice(0, 8)
                        .map((i) => i.id) ?? [],
                    );
                  }}
                >
                  <SelectTrigger id="poker-project" className="w-full">
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
              <FieldSet>
                <FieldLegend variant="label">Issues to estimate ({picked.length})</FieldLegend>
                <FieldDescription>
                  Open stories, tasks and bugs without an estimate, in backlog order.
                </FieldDescription>
                {project?.issues.length ? (
                  <ul className="max-h-64 divide-y overflow-y-auto rounded-md border">
                    {project.issues.map((issue) => (
                      <li key={issue.id}>
                        <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-accent">
                          <Checkbox
                            checked={picked.includes(issue.id)}
                            onCheckedChange={(on) =>
                              setPicked((list) =>
                                on ? [...list, issue.id] : list.filter((x) => x !== issue.id),
                              )
                            }
                          />
                          <IssueTypeIcon type={issue.type} tooltip={false} />
                          <span className="font-mono text-xs text-muted-foreground">
                            {issue.key}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{issue.title}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nothing left to estimate in this project.
                  </p>
                )}
              </FieldSet>
              {create.result.serverError ? (
                <FieldError>{create.result.serverError.message}</FieldError>
              ) : null}
            </FieldGroup>
            <DialogFooter className="mt-6">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim() || !picked.length || create.isPending}>
                {create.isPending ? <Spinner /> : null}
                Start session
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
