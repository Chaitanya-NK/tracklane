"use client";

import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { completeSprintAction } from "../server/actions";

export function CompleteSprintDialog({
  sprint,
  doneCount,
  openCount,
  plannedSprints,
  open,
  onOpenChange,
}: {
  sprint: { id: string; name: string };
  doneCount: number;
  openCount: number;
  plannedSprints: { id: string; name: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [target, setTarget] = useState<string>(plannedSprints[0]?.id ?? "backlog");
  // The sprint's section disappears once it's completed, unmounting this dialog, so the toast
  // is shown after awaiting rather than from an onSuccess callback.
  const complete = useAction(completeSprintAction);
  async function run() {
    const res = await complete.executeAsync({
      sprintId: sprint.id,
      moveOpenTo: target === "backlog" ? null : target,
    });
    if (!res?.data) return;
    const { name, completed, moved } = res.data;
    toast.success(`${name} completed: ${completed} done${moved ? `, ${moved} moved` : ""}`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete {sprint.name}</DialogTitle>
          <DialogDescription>
            {doneCount} issue{doneCount === 1 ? "" : "s"} done and {openCount} still open.
          </DialogDescription>
        </DialogHeader>
        {complete.result.serverError ? (
          <Alert variant="destructive">
            <AlertDescription>{complete.result.serverError.message}</AlertDescription>
          </Alert>
        ) : null}
        {openCount > 0 ? (
          <Field>
            <FieldLabel htmlFor="move-open">Move open issues to</FieldLabel>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger id="move-open" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {plannedSprints.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
                <SelectItem value="backlog">Backlog</SelectItem>
              </SelectContent>
            </Select>
            <FieldDescription>Done issues stay in this sprint for its report.</FieldDescription>
          </Field>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={complete.isPending}>
            Cancel
          </Button>
          <Button disabled={complete.isPending} onClick={run}>
            {complete.isPending ? <Spinner /> : null}
            Complete sprint
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
