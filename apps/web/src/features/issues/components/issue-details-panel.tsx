"use client";

import {
  ISSUE_TYPE_LABELS,
  ISSUE_TYPES,
  type IssueType,
  PRIORITIES,
  PRIORITY_LABELS,
  type Priority,
  type StatusCategory,
} from "@tracklane/core";
import { format } from "date-fns";
import type { ReactNode } from "react";
import { useState } from "react";
import { DatePicker, parseDateValue } from "@/components/shared/date-picker";
import { TimeAgo } from "@/components/shared/time-ago";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  sprintId: string | null;
  labelIds: string[];
  startDate: Date | null;
  dueDate: Date | null;
  estimate: number | null;
  reporter: { name: string; image: string | null } | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  hasChildren: boolean;
}

function Row({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <Field orientation="horizontal" className="grid grid-cols-[7rem_1fr] items-center gap-2 py-1">
      <FieldLabel htmlFor={htmlFor} className="font-normal text-muted-foreground">
        {label}
      </FieldLabel>
      <div className="flex min-w-0 flex-col">{children}</div>
    </Field>
  );
}

/** Right-hand details card. Each field saves as soon as it changes and confirms with a toast. */
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
  const nameOf = (userId: string | null) => options.assignees.find((u) => u.id === userId)?.name;
  const parentLabel = issue.type === "subtask" ? "Parent" : "Epic";

  const typeSelect = (
    <Select
      value={issue.type}
      onValueChange={(v) =>
        save({ type: v as IssueType }, `Type changed to ${ISSUE_TYPE_LABELS[v as IssueType]}`)
      }
      disabled={disabled || issue.hasChildren}
    >
      <SelectTrigger id="f-type" size="sm" className="w-full border-transparent shadow-none">
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
  );

  return (
    <div>
      <Row label="Status" htmlFor="f-status">
        <Select
          value={issue.statusId}
          onValueChange={(statusId) => {
            const status = options.statuses.find((s) => s.id === statusId);
            void save({ statusId }, `Status changed to ${status?.name ?? "new status"}`);
          }}
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
      </Row>
      <Row label="Assignee" htmlFor="f-assignee">
        <AssigneePicker
          id="f-assignee"
          variant="ghost"
          value={issue.assigneeId}
          onChange={(assigneeId) =>
            assigneeId !== issue.assigneeId &&
            save({ assigneeId }, assigneeId ? `Assigned to ${nameOf(assigneeId)}` : "Unassigned")
          }
          users={options.assignees}
          currentUserId={options.currentUserId}
          disabled={disabled}
        />
        {!disabled && issue.assigneeId !== options.currentUserId ? (
          <Button
            variant="link"
            size="sm"
            className="h-auto self-start px-2 py-0 text-xs"
            onClick={() => save({ assigneeId: options.currentUserId }, "Assigned to you")}
          >
            Assign to me
          </Button>
        ) : null}
      </Row>
      <Row label="Labels" htmlFor="f-labels">
        <LabelsPicker
          id="f-labels"
          variant="ghost"
          value={issue.labelIds}
          onChange={(labelIds) => save({ labelIds }, "Labels updated")}
          labels={options.labels}
          disabled={disabled}
        />
      </Row>
      <Row label={parentLabel} htmlFor="f-parent">
        <ParentPicker
          id="f-parent"
          variant="ghost"
          value={issue.parentId}
          onChange={(parentId) =>
            parentId !== issue.parentId &&
            save({ parentId }, parentId ? `${parentLabel} updated` : `${parentLabel} removed`)
          }
          parents={options.parents}
          projectKey={options.project.key}
          childType={issue.type}
          excludeId={issue.id}
          disabled={disabled}
        />
      </Row>
      {options.project.type === "scrum" ? (
        <Row label="Sprint" htmlFor="f-sprint">
          <Select
            value={issue.sprintId ?? "backlog"}
            onValueChange={(value) => {
              const sprintId = value === "backlog" ? null : value;
              const name = options.sprints.find((s) => s.id === sprintId)?.name;
              void save({ sprintId }, sprintId ? `Moved to ${name}` : "Moved to the backlog");
            }}
            disabled={disabled}
          >
            <SelectTrigger
              id="f-sprint"
              size="sm"
              className="w-full border-transparent shadow-none"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="backlog">Backlog</SelectItem>
              {issue.sprintId && !options.sprints.some((s) => s.id === issue.sprintId) ? (
                <SelectItem value={issue.sprintId} disabled>
                  Completed sprint
                </SelectItem>
              ) : null}
              {options.sprints.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                  {s.state === "active" ? " (active)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
      ) : null}
      <Row label="Priority" htmlFor="f-priority">
        <Select
          value={issue.priority}
          onValueChange={(v) =>
            save({ priority: v as Priority }, `Priority set to ${PRIORITY_LABELS[v as Priority]}`)
          }
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
                <PriorityIcon priority={p} tooltip={false} /> {PRIORITY_LABELS[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>
      <Row label="Type" htmlFor="f-type">
        {issue.hasChildren ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div>{typeSelect}</div>
            </TooltipTrigger>
            <TooltipContent>Issues with child issues can&apos;t change type</TooltipContent>
          </Tooltip>
        ) : (
          typeSelect
        )}
      </Row>
      <Row label="Start date" htmlFor="f-start">
        <DatePicker
          id="f-start"
          variant="ghost"
          placeholder="None"
          value={toDateInputValue(issue.startDate) || null}
          disabled={disabled}
          onChange={(startDate) =>
            save(
              { startDate },
              startDate
                ? `Start date set to ${format(parseDateValue(startDate)!, "d MMM yyyy")}`
                : "Start date cleared",
            )
          }
        />
      </Row>
      <Row label="Due date" htmlFor="f-due">
        <DatePicker
          id="f-due"
          variant="ghost"
          placeholder="None"
          value={toDateInputValue(issue.dueDate) || null}
          disabled={disabled}
          onChange={(dueDate) =>
            save(
              { dueDate },
              dueDate
                ? `Due date set to ${format(parseDateValue(dueDate)!, "d MMM yyyy")}`
                : "Due date cleared",
            )
          }
        />
      </Row>
      <Row label="Story points" htmlFor="f-estimate">
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
            if (next !== issue.estimate) {
              void save(
                { estimate: next },
                next === null ? "Story points cleared" : `Story points set to ${next}`,
              );
            }
          }}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
      </Row>
      <Row label="Reporter">
        {issue.reporter ? (
          <span className="flex items-center gap-2 px-2 text-sm">
            <UserAvatar user={issue.reporter} className="size-5" />
            {issue.reporter.name}
          </span>
        ) : (
          <span className="px-2 text-sm text-muted-foreground">Former member</span>
        )}
      </Row>
      <FieldSeparator className="my-2" />
      <div className="space-y-0.5 text-xs text-muted-foreground">
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
