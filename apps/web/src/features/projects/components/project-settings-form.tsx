"use client";

import { Loader2Icon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { MarkdownEditor } from "@/components/shared/markdown-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateProjectAction } from "../server/actions";

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
        <div className="space-y-2">
          <Label htmlFor="p-name">Name</Label>
          <Input
            id="p-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
          />
          {result.validationErrors?.name ? (
            <p className="text-sm text-destructive">{result.validationErrors.name._errors?.[0]}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-key">Key</Label>
          <Input id="p-key" value={project.key} disabled className="w-40 font-mono" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-lead">Project lead</Label>
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
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-description">Description</Label>
          <MarkdownEditor
            id="p-description"
            value={description}
            onChange={setDescription}
            rows={5}
          />
        </div>
      </fieldset>
      {canEdit ? (
        <Button type="submit" disabled={!dirty || isPending}>
          {isPending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : null}
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
