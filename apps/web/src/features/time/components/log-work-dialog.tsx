"use client";

import { formatDuration, parseDuration } from "@tracklane/core";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { DatePicker } from "@/components/shared/date-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { logWorkAction, updateWorklogAction } from "../server/actions";

const today = () => new Date().toISOString().slice(0, 10);

export interface WorklogDraft {
  id: string;
  minutes: number;
  date: string;
  note: string;
}

/** Log time on an issue (or edit an entry). Durations like "1h 30m"; a day is 8 hours. */
export function LogWorkDialog({
  issueId,
  issueKey,
  worklog,
  open,
  onOpenChange,
}: {
  issueId: string;
  issueKey: string;
  worklog?: WorklogDraft;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [spent, setSpent] = useState(worklog ? formatDuration(worklog.minutes) : "");
  const [date, setDate] = useState<string | null>(worklog?.date ?? today());
  const [note, setNote] = useState(worklog?.note ?? "");
  const log = useAction(logWorkAction);
  const update = useAction(updateWorklogAction);
  const minutes = parseDuration(spent);
  const pending = log.isPending || update.isPending;
  const error = (worklog ? update : log).result.serverError?.message;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!minutes || !date) return;
    const res = worklog
      ? await update.executeAsync({ worklogId: worklog.id, minutes, date, note })
      : await log.executeAsync({ issueId, minutes, date, note });
    if (res?.serverError || res?.validationErrors) return;
    toast.success(
      worklog ? "Time entry updated" : `Logged ${formatDuration(minutes)} on ${issueKey}`,
    );
    onOpenChange(false);
    if (!worklog) {
      setSpent("");
      setNote("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{worklog ? "Edit time entry" : `Log time on ${issueKey}`}</DialogTitle>
          <DialogDescription>Use w, d, h and m — a day is 8 hours.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field data-invalid={(spent && !minutes) || undefined}>
              <FieldLabel htmlFor="log-spent">Time spent</FieldLabel>
              <Input
                id="log-spent"
                value={spent}
                onChange={(e) => setSpent(e.target.value)}
                placeholder="1h 30m"
                autoFocus
              />
              <FieldDescription>
                {minutes ? `= ${formatDuration(minutes)}` : "e.g. 45m, 2h, 1d"}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="log-date">Date</FieldLabel>
              <DatePicker id="log-date" value={date} onChange={setDate} aria-label="Date" />
            </Field>
            <Field>
              <FieldLabel htmlFor="log-note">What did you do?</FieldLabel>
              <Textarea
                id="log-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
              />
            </Field>
            {error ? <FieldError>{error}</FieldError> : null}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!minutes || !date || pending}>
              {pending ? <Spinner /> : null}
              {worklog ? "Save" : "Log time"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
