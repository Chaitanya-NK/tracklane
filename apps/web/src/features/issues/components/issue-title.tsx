"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useIssueUpdate } from "./use-issue-update";

/** The issue summary; click to edit, Enter to save, Escape to cancel. */
export function IssueTitle({
  issueId,
  title,
  canEdit,
}: {
  issueId: string;
  title: string;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const { save } = useIssueUpdate(issueId);

  async function commit() {
    const next = value.trim();
    setEditing(false);
    if (!next || next === title) return setValue(title);
    if (!(await save({ title: next }))) setValue(title);
  }

  if (editing) {
    return (
      <Input
        autoFocus
        value={value}
        maxLength={255}
        aria-label="Summary"
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setValue(title);
            setEditing(false);
          }
        }}
        className="h-auto py-1 text-2xl font-semibold tracking-tight md:text-2xl"
      />
    );
  }
  return (
    <h1 className="text-2xl font-semibold tracking-tight break-words">
      {canEdit ? (
        <button
          type="button"
          onClick={() => {
            setValue(title);
            setEditing(true);
          }}
          className="-mx-1.5 rounded px-1.5 text-left hover:bg-muted"
          title="Click to edit"
        >
          {title}
        </button>
      ) : (
        title
      )}
    </h1>
  );
}
