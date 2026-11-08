"use client";

import {
  ALLOWED_PARENT_TYPES,
  ISSUE_TYPE_LABELS,
  ISSUE_TYPES,
  type IssueType,
  PRIORITIES,
  PRIORITY_LABELS,
  type Priority,
} from "@tracklane/core";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DatePicker } from "@/components/shared/date-picker";
import { MarkdownEditor } from "@/components/shared/markdown-editor";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createIssueAction,
  getIssueFormOptionsAction,
  listProjectOptionsAction,
} from "../server/actions";
import type { IssueFormOptions, ProjectOption } from "../types";
import { AssigneePicker, LabelsPicker, ParentPicker } from "./field-pickers";
import { IssueTypeIcon, PriorityIcon } from "./issue-meta";
import { Spinner } from "@/components/ui/spinner";

export interface CreateIssueDefaults {
  projectKey?: string;
  type?: IssueType;
  parentId?: string;
}

interface Draft {
  type: IssueType;
  title: string;
  description: string;
  priority: Priority;
  statusId: string | undefined;
  assigneeId: string | null;
  parentId: string | null;
  labelIds: string[];
  dueDate: string;
  estimate: string;
}

const emptyDraft = (defaults: CreateIssueDefaults): Draft => ({
  type: defaults.type ?? "task",
  title: "",
  description: "",
  priority: "medium",
  statusId: undefined,
  assigneeId: null,
  parentId: defaults.parentId ?? null,
  labelIds: [],
  dueDate: "",
  estimate: "",
});

export function CreateIssueDialog({
  open,
  onOpenChange,
  slug,
  defaults,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  defaults: CreateIssueDefaults;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create issue</DialogTitle>
          <DialogDescription>Required fields are marked with an asterisk.</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so every opening starts from a fresh draft. */}
        {open ? (
          <CreateIssueForm slug={slug} defaults={defaults} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CreateIssueForm({
  slug,
  defaults,
  onDone,
}: {
  slug: string;
  defaults: CreateIssueDefaults;
  onDone: () => void;
}) {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectOption[] | null>(null);
  const [chosenKey, setChosenKey] = useState<string | undefined>(defaults.projectKey);
  const [loaded, setLoaded] = useState<{ key: string; options: IssueFormOptions | null } | null>(
    null,
  );
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(defaults));
  const [createAnother, setCreateAnother] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);

  const loadProjects = useAction(listProjectOptionsAction);
  const loadOptions = useAction(getIssueFormOptionsAction);
  const create = useAction(createIssueAction);

  const projectKey = chosenKey ?? projects?.[0]?.key;
  const options = loaded && loaded.key === projectKey ? loaded.options : null;

  useEffect(() => {
    let cancelled = false;
    loadProjects.executeAsync({ slug }).then((res) => !cancelled && setProjects(res?.data ?? []));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per opening
  }, [slug]);

  useEffect(() => {
    if (!projectKey) return;
    let cancelled = false;
    loadOptions
      .executeAsync({ slug, projectKey })
      .then((res) => !cancelled && setLoaded({ key: projectKey, options: res?.data ?? null }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when the project changes
  }, [slug, projectKey]);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  async function submit(event?: React.FormEvent) {
    event?.preventDefault();
    if (!projectKey || !options) return;
    if (!draft.title.trim()) return setTitleError("Give the issue a summary");
    setTitleError(null);
    const res = await create.executeAsync({
      slug,
      projectKey,
      type: draft.type,
      title: draft.title,
      description: draft.description,
      priority: draft.priority,
      statusId: draft.statusId,
      assigneeId: draft.assigneeId,
      parentId: ALLOWED_PARENT_TYPES[draft.type].length ? draft.parentId : null,
      labelIds: draft.labelIds,
      dueDate: draft.dueDate || null,
      estimate: draft.estimate === "" ? null : Number(draft.estimate),
    });
    if (!res?.data) return;
    const href = `/${slug}/issues/${res.data.key}` as Route;
    toast.success(`Created ${res.data.key}`, {
      action: { label: "View", onClick: () => router.push(href) },
    });
    if (createAnother) {
      setDraft((d) => ({ ...emptyDraft(defaults), type: d.type, parentId: d.parentId }));
    } else {
      onDone();
    }
  }

  const parentTypes = ALLOWED_PARENT_TYPES[draft.type];
  const noProjects = projects !== null && projects.length === 0;
  const currentUserId = options?.currentUserId;

  return (
    <>
      {noProjects ? (
        <Alert>
          <AlertDescription>Create a project first — issues live inside projects.</AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {create.result.serverError ? (
            <Alert variant="destructive">
              <AlertDescription>{create.result.serverError.message}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="ci-project">Project *</FieldLabel>
              <Select value={projectKey} onValueChange={setChosenKey} disabled={!projects}>
                <SelectTrigger id="ci-project" className="w-full">
                  <SelectValue placeholder="Loading…" />
                </SelectTrigger>
                <SelectContent>
                  {(projects ?? []).map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.name} ({p.key})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="ci-type">Issue type *</FieldLabel>
              <Select value={draft.type} onValueChange={(v) => update("type", v as IssueType)}>
                <SelectTrigger id="ci-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ISSUE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      <IssueTypeIcon type={t} tooltip={false} /> {ISSUE_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {!options ? (
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : !options.canCreate ? (
            <Alert>
              <AlertDescription>
                Your role can view issues in this project but not create them.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Field data-invalid={Boolean(titleError) || undefined}>
                <FieldLabel htmlFor="ci-title">Summary *</FieldLabel>
                <Input
                  id="ci-title"
                  value={draft.title}
                  onChange={(e) => update("title", e.target.value)}
                  autoFocus
                  maxLength={255}
                  aria-invalid={Boolean(titleError)}
                />
                {titleError ? <FieldError>{titleError}</FieldError> : null}
              </Field>

              <Field>
                <FieldLabel htmlFor="ci-description">Description</FieldLabel>
                <MarkdownEditor
                  id="ci-description"
                  value={draft.description}
                  onChange={(v) => update("description", v)}
                  placeholder="Steps to reproduce, acceptance criteria, links…"
                  rows={5}
                  onSubmit={() => submit()}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="ci-status">Status</FieldLabel>
                  <Select
                    value={draft.statusId ?? options.statuses[0]?.id}
                    onValueChange={(v) => update("statusId", v)}
                  >
                    <SelectTrigger id="ci-status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options.statuses.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="ci-priority">Priority</FieldLabel>
                  <Select
                    value={draft.priority}
                    onValueChange={(v) => update("priority", v as Priority)}
                  >
                    <SelectTrigger id="ci-priority" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[...PRIORITIES].reverse().map((p) => (
                        <SelectItem key={p} value={p}>
                          <PriorityIcon priority={p} tooltip={false} /> {PRIORITY_LABELS[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <div className="flex items-center justify-between">
                    <FieldLabel htmlFor="ci-assignee">Assignee</FieldLabel>
                    {currentUserId && draft.assigneeId !== currentUserId ? (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs"
                        onClick={() => update("assigneeId", currentUserId)}
                      >
                        Assign to me
                      </Button>
                    ) : null}
                  </div>
                  <AssigneePicker
                    id="ci-assignee"
                    value={draft.assigneeId}
                    onChange={(v) => update("assigneeId", v)}
                    users={options.assignees}
                    currentUserId={currentUserId}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="ci-labels">Labels</FieldLabel>
                  <LabelsPicker
                    id="ci-labels"
                    value={draft.labelIds}
                    onChange={(v) => update("labelIds", v)}
                    labels={options.labels}
                  />
                </Field>
                {parentTypes.length ? (
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor="ci-parent">
                      {draft.type === "subtask" ? "Parent issue *" : "Epic"}
                    </FieldLabel>
                    <ParentPicker
                      id="ci-parent"
                      value={draft.parentId}
                      onChange={(v) => update("parentId", v)}
                      parents={options.parents}
                      projectKey={options.project.key}
                      childType={draft.type}
                    />
                  </Field>
                ) : null}
                <Field>
                  <FieldLabel htmlFor="ci-due">Due date</FieldLabel>
                  <DatePicker
                    id="ci-due"
                    placeholder="No due date"
                    value={draft.dueDate || null}
                    onChange={(value) => update("dueDate", value ?? "")}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="ci-estimate">Story points</FieldLabel>
                  <Input
                    id="ci-estimate"
                    type="number"
                    min={0}
                    max={999}
                    inputMode="numeric"
                    value={draft.estimate}
                    onChange={(e) => update("estimate", e.target.value)}
                  />
                </Field>
              </div>

              <DialogFooter className="items-center sm:justify-between">
                <Field orientation="horizontal" className="w-auto">
                  <Checkbox
                    id="ci-another"
                    checked={createAnother}
                    onCheckedChange={(v) => setCreateAnother(v === true)}
                  />
                  <FieldLabel htmlFor="ci-another" className="font-normal">
                    Create another
                  </FieldLabel>
                </Field>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={onDone}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={create.isPending}>
                    {create.isPending ? <Spinner /> : null}
                    Create
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </form>
      )}
    </>
  );
}
