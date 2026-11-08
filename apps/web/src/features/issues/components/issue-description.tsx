"use client";

import { PencilIcon } from "lucide-react";
import { useState } from "react";
import { Markdown } from "@/components/shared/markdown";
import { MarkdownEditor } from "@/components/shared/markdown-editor";
import { Button } from "@/components/ui/button";
import { useIssueUpdate } from "./use-issue-update";
import { Spinner } from "@/components/ui/spinner";

export function IssueDescription({
  issueId,
  description,
  canEdit,
}: {
  issueId: string;
  description: string;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(description);
  const { save, isPending } = useIssueUpdate(issueId);

  async function commit() {
    if (value === description) return setEditing(false);
    if (await save({ description: value }, "Description updated")) setEditing(false);
  }

  return (
    <section className="space-y-2" aria-labelledby="description-heading">
      <div className="flex items-center justify-between">
        <h2 id="description-heading" className="text-sm font-semibold">
          Description
        </h2>
        {canEdit && !editing && description ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (setValue(description), setEditing(true))}
          >
            <PencilIcon aria-hidden="true" /> Edit
          </Button>
        ) : null}
      </div>
      {editing ? (
        <div className="space-y-2">
          <MarkdownEditor
            value={value}
            onChange={setValue}
            rows={10}
            autoFocus
            onSubmit={commit}
            aria-label="Description"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={commit} disabled={isPending}>
              {isPending ? <Spinner /> : null}
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditing(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : description ? (
        <Markdown>{description}</Markdown>
      ) : canEdit ? (
        <Button
          variant="outline"
          onClick={() => (setValue(""), setEditing(true))}
          className="h-auto w-full justify-start border-dashed px-3 py-6 font-normal text-muted-foreground"
        >
          Add a description…
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">No description.</p>
      )}
    </section>
  );
}
