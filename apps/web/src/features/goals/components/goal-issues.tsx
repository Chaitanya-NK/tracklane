"use client";

import { LinkIcon, XIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldDescription, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { IssueTypeIcon, StatusBadge } from "@/features/issues";
import { cn } from "@/lib/utils";
import { linkGoalIssuesAction, unlinkGoalIssueAction } from "../server/actions";

interface GoalIssue {
  id: string;
  key: string;
  title: string;
  type: "story" | "task" | "bug" | "epic" | "subtask";
  customType: { name: string; color: string; icon: string } | null;
  status: { name: string; category: "todo" | "in_progress" | "done" };
  children: number;
}

export function GoalIssues({
  slug,
  goalId,
  issues,
  canEdit,
}: {
  slug: string;
  goalId: string;
  issues: GoalIssue[];
  canEdit: boolean;
}) {
  const [keys, setKeys] = useState("");
  const link = useAction(linkGoalIssuesAction);
  const unlink = useAction(unlinkGoalIssueAction);
  const error = link.result.serverError;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const res = await link.executeAsync({ slug, goalId, keys });
    if (!res?.data) return;
    toast.success(
      res.data.added
        ? `Linked ${res.data.added} ${res.data.added === 1 ? "issue" : "issues"}`
        : "Already linked",
    );
    setKeys("");
  }

  return (
    <section className="space-y-3" aria-labelledby="goal-issues">
      <h2 id="goal-issues" className="text-sm font-semibold">
        Linked issues <span className="font-normal text-muted-foreground">({issues.length})</span>
      </h2>
      {canEdit ? (
        <form onSubmit={submit} className="space-y-1">
          <div className="flex gap-2">
            <Input
              value={keys}
              onChange={(e) => setKeys(e.target.value)}
              placeholder="DEV-12, DEV-15"
              aria-label="Issue keys to link"
              className="max-w-sm font-mono uppercase"
              aria-invalid={error ? true : undefined}
            />
            <Button type="submit" variant="outline" disabled={!keys.trim() || link.isPending}>
              {link.isPending ? <Spinner /> : <LinkIcon />}
              Link
            </Button>
          </div>
          {error ? (
            <FieldError>{error.message}</FieldError>
          ) : (
            <FieldDescription>
              Link epics to count all their issues, or individual issues.
            </FieldDescription>
          )}
        </form>
      ) : null}
      {issues.length ? (
        <ul className="divide-y rounded-lg border">
          {issues.map((issue) => (
            <li key={issue.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <IssueTypeIcon type={issue.type} custom={issue.customType} />
              <Link
                href={`/${slug}/issues/${issue.key}` as Route}
                className={cn(
                  "shrink-0 font-mono text-xs text-muted-foreground hover:underline",
                  issue.status.category === "done" && "line-through",
                )}
              >
                {issue.key}
              </Link>
              <span className="min-w-0 flex-1 truncate">{issue.title}</span>
              {issue.type === "epic" && issue.children ? (
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {issue.children} issues
                </span>
              ) : null}
              <StatusBadge status={issue.status} />
              {canEdit ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={`Unlink ${issue.key}`}
                  disabled={unlink.isPending}
                  onClick={async () => {
                    const res = await unlink.executeAsync({ slug, goalId, issueId: issue.id });
                    if (res?.serverError) toast.error(res.serverError.message);
                    else toast.success(`Unlinked ${issue.key}`);
                  }}
                >
                  <XIcon />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No issues linked yet.</p>
      )}
    </section>
  );
}
