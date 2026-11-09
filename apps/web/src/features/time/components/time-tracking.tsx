"use client";

import { formatDuration, parseDuration } from "@tracklane/core";
import { ClockIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { TimeAgo } from "@/components/shared/time-ago";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { updateIssueAction } from "@/features/issues/server/actions";
import { deleteWorklogAction } from "../server/actions";
import { LogWorkDialog, type WorklogDraft } from "./log-work-dialog";

/** Estimate, logged time and "Log time" — for the issue details panel. */
export function TimeTracking({
  issueId,
  issueKey,
  estimate,
  logged,
  canEdit,
}: {
  issueId: string;
  issueKey: string;
  estimate: number | null;
  logged: number;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(estimate === null ? "" : formatDuration(estimate));
  const update = useAction(updateIssueAction);
  const remaining = estimate === null ? null : Math.max(0, estimate - logged);
  const over = estimate !== null && logged > estimate;
  const percent = estimate
    ? Math.min(100, Math.round((logged / estimate) * 100))
    : logged
      ? 100
      : 0;

  async function saveEstimate() {
    const minutes = draft.trim() ? parseDuration(draft) : null;
    if (draft.trim() && minutes === null) {
      toast.error("Use a duration like 4h or 2d");
      return;
    }
    if (minutes === estimate) return;
    const res = await update.executeAsync({ issueId, patch: { timeEstimate: minutes } });
    if (res?.serverError) toast.error(res.serverError.message);
    else
      toast.success(
        minutes === null ? "Estimate cleared" : `Estimate set to ${formatDuration(minutes)}`,
      );
  }

  return (
    <div className="w-full space-y-1.5 px-2 py-1">
      <Progress
        value={percent}
        className={over ? "[&>div]:bg-destructive" : undefined}
        aria-label={`${formatDuration(logged)} logged${estimate !== null ? ` of ${formatDuration(estimate)}` : ""}`}
      />
      <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">{formatDuration(logged)}</span> logged
        </span>
        {remaining !== null ? (
          <span className={over ? "text-destructive" : undefined}>
            ·{" "}
            {over
              ? `${formatDuration(logged - estimate!)} over`
              : `${formatDuration(remaining)} left`}
          </span>
        ) : null}
      </div>
      {canEdit ? (
        <div className="flex items-center gap-1.5">
          <Input
            aria-label="Original estimate"
            placeholder="Estimate (e.g. 2d)"
            className="h-7 w-32 text-xs"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={saveEstimate}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
          <Button size="sm" variant="outline" className="h-7" onClick={() => setOpen(true)}>
            <PlusIcon />
            Log time
          </Button>
        </div>
      ) : null}
      <LogWorkDialog issueId={issueId} issueKey={issueKey} open={open} onOpenChange={setOpen} />
    </div>
  );
}

export interface WorklogItem {
  id: string;
  minutes: number;
  date: Date;
  note: string;
  createdAt: Date;
  user: { id: string; name: string; image: string | null } | null;
}

/** The "Work log" tab on an issue. */
export function WorkLogList({
  issueId,
  issueKey,
  worklogs,
  currentUserId,
  canModerate,
}: {
  issueId: string;
  issueKey: string;
  worklogs: WorklogItem[];
  currentUserId: string;
  canModerate: boolean;
}) {
  const [editing, setEditing] = useState<WorklogDraft | null>(null);
  const [deleting, setDeleting] = useState<WorklogItem | null>(null);
  const remove = useAction(deleteWorklogAction);

  async function confirmDelete() {
    if (!deleting) return;
    const res = await remove.executeAsync({ worklogId: deleting.id });
    if (res?.serverError) return void toast.error(res.serverError.message);
    toast.success("Time entry deleted");
    setDeleting(null);
  }

  if (!worklogs.length) {
    return (
      <EmptyState
        icon={ClockIcon}
        title="No time logged"
        description="Use Log time in the details panel to record work."
      />
    );
  }
  return (
    <>
      <ul className="divide-y rounded-lg border">
        {worklogs.map((w) => {
          const mine = w.user?.id === currentUserId;
          return (
            <li key={w.id} className="flex items-start gap-3 p-3 text-sm">
              <UserAvatar user={w.user ?? { name: "?", image: null }} className="mt-0.5 size-7" />
              <div className="min-w-0 flex-1">
                <p>
                  <span className="font-medium">{w.user?.name ?? "Former member"}</span> logged{" "}
                  <span className="font-medium">{formatDuration(w.minutes)}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    for {w.date.toISOString().slice(0, 10)} · <TimeAgo date={w.createdAt} />
                  </span>
                </p>
                {w.note ? <p className="mt-0.5 text-muted-foreground">{w.note}</p> : null}
              </div>
              {mine || canModerate ? (
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    aria-label="Edit time entry"
                    onClick={() =>
                      setEditing({
                        id: w.id,
                        minutes: w.minutes,
                        date: w.date.toISOString().slice(0, 10),
                        note: w.note,
                      })
                    }
                  >
                    <PencilIcon />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    aria-label="Delete time entry"
                    onClick={() => setDeleting(w)}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {editing ? (
        <LogWorkDialog
          key={editing.id}
          issueId={issueId}
          issueKey={issueKey}
          worklog={editing}
          open
          onOpenChange={(open) => !open && setEditing(null)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this time entry?"
        description={
          deleting
            ? `${formatDuration(deleting.minutes)} logged by ${deleting.user?.name ?? "a former member"}.`
            : ""
        }
        pending={remove.isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
}
