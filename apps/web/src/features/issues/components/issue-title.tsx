"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
    if (!(await save({ title: next }, "Summary updated"))) setValue(title);
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
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              onClick={() => {
                setValue(title);
                setEditing(true);
              }}
              className="-mx-2 h-auto w-full justify-start px-2 py-1 text-left text-2xl font-semibold tracking-tight break-words whitespace-normal"
            >
              {title}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Click to edit</TooltipContent>
        </Tooltip>
      ) : (
        title
      )}
    </h1>
  );
}
