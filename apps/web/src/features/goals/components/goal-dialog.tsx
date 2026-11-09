"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { saveGoalAction } from "../server/actions";
import { GOAL_STATUS_LABELS, type GoalStatus } from "./goal-status";

export interface GoalDraft {
  id: string;
  name: string;
  description: string;
  status: GoalStatus;
  ownerId: string | null;
  targetDate: string | null;
}

export function GoalDialog({
  slug,
  goal,
  people,
  currentUserId,
  onClose,
}: {
  slug: string;
  goal?: GoalDraft;
  people: { id: string; name: string }[];
  currentUserId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(goal?.name ?? "");
  const [description, setDescription] = useState(goal?.description ?? "");
  const [status, setStatus] = useState<GoalStatus>(goal?.status ?? "on_track");
  const [ownerId, setOwnerId] = useState(goal ? (goal.ownerId ?? "none") : currentUserId);
  const [targetDate, setTargetDate] = useState<string | null>(goal?.targetDate ?? null);
  const save = useAction(saveGoalAction);
  const error = save.result.serverError;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const res = await save.executeAsync({
      slug,
      goalId: goal?.id ?? null,
      goal: { name, description, status, ownerId: ownerId === "none" ? null : ownerId, targetDate },
    });
    if (!res?.data) return;
    toast.success(goal ? `Saved ${res.data.name}` : `Created ${res.data.name}`);
    onClose();
    if (!goal) router.push(`/${slug}/goals/${res.data.id}` as Route);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{goal ? `Edit ${goal.name}` : "New goal"}</DialogTitle>
          <DialogDescription>
            An outcome the workspace is working towards, measured by the issues linked to it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="goal-name">Name</FieldLabel>
              <Input
                id="goal-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                autoFocus
                placeholder="Launch the mobile app"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="goal-status">Status</FieldLabel>
                <Select value={status} onValueChange={(v) => setStatus(v as GoalStatus)}>
                  <SelectTrigger id="goal-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(GOAL_STATUS_LABELS) as GoalStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {GOAL_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="goal-owner">Owner</FieldLabel>
                <Select value={ownerId} onValueChange={setOwnerId}>
                  <SelectTrigger id="goal-owner" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No owner</SelectItem>
                    {people.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="goal-target">Target date</FieldLabel>
                <DatePicker
                  id="goal-target"
                  value={targetDate}
                  onChange={setTargetDate}
                  placeholder="Optional"
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="goal-desc">Description</FieldLabel>
              <Textarea
                id="goal-desc"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Why it matters and how you'll know it's done (Markdown)"
              />
            </Field>
            {error ? <FieldError>{error.message}</FieldError> : null}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || save.isPending}>
              {save.isPending ? <Spinner /> : null}
              {goal ? "Save" : "Create goal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
