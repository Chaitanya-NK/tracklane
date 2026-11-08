"use client";

import { TimeAgo } from "@/components/shared/time-ago";
import {
  ISSUE_TYPE_LABELS,
  ISSUE_TYPES,
  type IssueType,
  PRIORITIES,
  PRIORITY_LABELS,
  type Priority,
  type StatusCategory,
} from "@tracklane/core";
import type { ReactNode } from "react";
import { useState } from "react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toDateInputValue } from "@/lib/format";
import type { IssueFormOptions } from "../types";
import { AssigneePicker, LabelsPicker, ParentPicker } from "./field-pickers";
import { IssueTypeIcon, PriorityIcon } from "./issue-meta";
import { useIssueUpdate } from "./use-issue-update";

export interface IssueDetailsValue {
  id: string;
  type: IssueType;
  priority: Priority;
  statusId: string;
  status: { name: string; category: StatusCategory };
  assigneeId: string | null;
  parentId: string | null;
  labelIds: string[];
  dueDate: Date | null;
  estimate: number | null;
  reporter: { name: string; image: string | null } | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  hasChildren: boolean;
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[7rem_1fr] items-center gap-2 py-1">
      <label htmlFor={htmlFor} className="text-sm text-muted-foreground">
        {label}
      </label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Right-hand details card. Each field saves as soon as it changes. */
export function IssueDetailsPanel({
  issue,
  options,
}: {
  issue: IssueDetailsValue;
  options: IssueFormOptions;
}) {
  const { save } = useIssueUpdate(issue.id);
  const disabled = !options.canEdit;
  const [estimate, setEstimate] = useState(issue.estimate?.toString() ?? "");

  return (
    <div className="space-y-1">
      <Field label="Status" htmlFor="f-status">
        <Select
          value={issue.statusId}
          onValueChange={(statusId) => save({ statusId })}
          disabled={disabled}
        >
          <SelectTrigger id="f-status" size="sm" className="w-full">
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
      <Field label="Assignee" htmlFor="f-assignee">
        <AssigneePicker
          id="f-assignee"
          variant="ghost"
          value={issue.assigneeId}
          onChange={(assigneeId) => assigneeId !== issue.assigneeId && save({ assigneeId })}
          users={options.assignees}
          currentUserId={options.currentUserId}
          disabled={disabled}
        />
        {!disabled && issue.assigneeId !== options.currentUserId ? (
          <button
            type="button"
            className="px-2 text-xs font-medium text-primary hover:underline"
            onClick={() => save({ assigneeId: options.currentUserId })}
          >
            Assign to me
          </button>
        ) : null}
      </Field>
      <Field label="Labels" htmlFor="f-labels">
        <LabelsPicker
          id="f-labels"
          variant="ghost"
          value={issue.labelIds}
          onChange={(labelIds) => save({ labelIds })}
          labels={options.labels}
          disabled={disabled}
        />
      </Field>
      <Field label={issue.type === "subtask" ? "Parent" : "Epic"} htmlFor="f-parent">
        <ParentPicker
          id="f-parent"
          variant="ghost"
          value={issue.parentId}
          onChange={(parentId) => parentId !== issue.parentId && save({ parentId })}
          parents={options.parents}
          projectKey={options.project.key}
          childType={issue.type}
          excludeId={issue.id}
          disabled={disabled}
        />
      </Field>
      <Field label="Priority" htmlFor="f-priority">
        <Select
          value={issue.priority}
          onValueChange={(v) => save({ priority: v as Priority })}
          disabled={disabled}
        >
          <SelectTrigger
            id="f-priority"
            size="sm"
            className="w-full border-transparent shadow-none"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[...PRIORITIES].reverse().map((p) => (
              <SelectItem key={p} value={p}>
                <PriorityIcon priority={p} /> {PRIORITY_LABELS[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Type" htmlFor="f-type">
        <Select
          value={issue.type}
          onValueChange={(v) => save({ type: v as IssueType })}
          disabled={disabled || issue.hasChildren}
        >
          <SelectTrigger
            id="f-type"
            size="sm"
            className="w-full border-transparent shadow-none"
            title={issue.hasChildren ? "Issues with child issues can't change type" : undefined}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ISSUE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                <IssueTypeIcon type={t} /> {ISSUE_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Due date" htmlFor="f-due">
        <Input
          id="f-due"
          type="date"
          className="h-8 border-transparent shadow-none"
          defaultValue={toDateInputValue(issue.dueDate)}
          disabled={disabled}
          onChange={(e) => save({ dueDate: e.target.value || null })}
        />
      </Field>
      <Field label="Story points" htmlFor="f-estimate">
        <Input
          id="f-estimate"
          type="number"
          min={0}
          max={999}
          inputMode="numeric"
          placeholder="None"
          className="h-8 border-transparent shadow-none"
          value={estimate}
          disabled={disabled}
          onChange={(e) => setEstimate(e.target.value)}
          onBlur={() => {
            const next = estimate === "" ? null : Number(estimate);
            if (next !== issue.estimate) save({ estimate: next });
          }}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
      </Field>
      <Field label="Reporter">
        {issue.reporter ? (
          <span className="flex items-center gap-2 px-2 text-sm">
            <UserAvatar user={issue.reporter} className="size-5" />
            {issue.reporter.name}
          </span>
        ) : (
          <span className="px-2 text-sm text-muted-foreground">Former member</span>
        )}
      </Field>
      <div className="space-y-0.5 border-t pt-3 text-xs text-muted-foreground">
        <p>
          <TimeAgo prefix="Created" date={issue.createdAt} />
        </p>
        <p>
          <TimeAgo prefix="Updated" date={issue.updatedAt} />
        </p>
        {issue.resolvedAt ? (
          <p>
            <TimeAgo prefix="Resolved" date={issue.resolvedAt} />
          </p>
        ) : null}
      </div>
    </div>
  );
}
