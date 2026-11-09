"use client";

import { MoreHorizontalIcon, PencilIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deleteGoalAction, setGoalStatusAction } from "../server/actions";
import { GoalDialog, type GoalDraft } from "./goal-dialog";
import { GOAL_STATUS_LABELS, type GoalStatus } from "./goal-status";

/** Status picker, edit and delete for a goal page. */
export function GoalActions({
  slug,
  goal,
  people,
  currentUserId,
  canEdit,
  canDelete,
}: {
  slug: string;
  goal: GoalDraft;
  people: { id: string; name: string }[];
  currentUserId: string;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const setStatus = useAction(setGoalStatusAction);
  const remove = useAction(deleteGoalAction);
  if (!canEdit) return null;
  return (
    <div className="flex items-center gap-2">
      <Select
        value={goal.status}
        onValueChange={async (v) => {
          const res = await setStatus.executeAsync({
            slug,
            goalId: goal.id,
            status: v as GoalStatus,
          });
          if (res?.serverError) toast.error(res.serverError.message);
          else toast.success(`Marked ${GOAL_STATUS_LABELS[v as GoalStatus].toLowerCase()}`);
        }}
      >
        <SelectTrigger size="sm" className="w-32" aria-label="Goal status">
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
      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
        <PencilIcon />
        Edit
      </Button>
      {canDelete ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" aria-label="More goal actions">
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
              Delete goal
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {editing ? (
        <GoalDialog
          slug={slug}
          goal={goal}
          people={people}
          currentUserId={currentUserId}
          onClose={() => setEditing(false)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${goal.name}?`}
        description="The linked issues are kept."
        pending={remove.isPending}
        onConfirm={async () => {
          const res = await remove.executeAsync({ slug, goalId: goal.id });
          if (res?.serverError) toast.error(res.serverError.message);
        }}
      />
    </div>
  );
}
