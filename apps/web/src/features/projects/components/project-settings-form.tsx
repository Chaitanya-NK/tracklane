"use client";

import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { MarkdownEditor } from "@/components/shared/markdown-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateProjectAction } from "../server/actions";
import { Spinner } from "@/components/ui/spinner";

export function ProjectSettingsForm({
  slug,
  project,
  members,
  canEdit,
}: {
  slug: string;
  project: { key: string; name: string; description: string; leadId: string | null };
  members: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [leadId, setLeadId] = useState(project.leadId ?? "none");
  const { execute, isPending, result } = useAction(updateProjectAction, {
    onSuccess: () => toast.success("Project updated"),
    onError: ({ error }) => toast.error(error.serverError?.message ?? "Couldn't save"),
  });
  const dirty =
    name !== project.name ||
    description !== project.description ||
    leadId !== (project.leadId ?? "none");

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        execute({
          slug,
          projectKey: project.key,
          name,
          description,
          leadId: leadId === "none" ? null : leadId,
        });
      }}
    >
      <fieldset disabled={!canEdit} className="space-y-4">
        <Field>
          <FieldLabel htmlFor="p-name">Name</FieldLabel>
          <Input
            id="p-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
          />
          {result.validationErrors?.name ? (
            <FieldError>{result.validationErrors.name._errors?.[0]}</FieldError>
          ) : null}
        </Field>
        <Field>
          <FieldLabel htmlFor="p-key">Key</FieldLabel>
          <Input id="p-key" value={project.key} disabled className="w-40 font-mono" />
        </Field>
        <Field>
          <FieldLabel htmlFor="p-lead">Project lead</FieldLabel>
          <Select value={leadId} onValueChange={setLeadId}>
            <SelectTrigger id="p-lead" className="w-full sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No lead</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="p-description">Description</FieldLabel>
          <MarkdownEditor
            id="p-description"
            value={description}
            onChange={setDescription}
            rows={5}
          />
        </Field>
      </fieldset>
      {canEdit ? (
        <Button type="submit" disabled={!dirty || isPending}>
          {isPending ? <Spinner /> : null}
          Save changes
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          Only admins and owners can change project settings.
        </p>
      )}
    </form>
  );
}
