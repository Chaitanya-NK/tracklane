"use client";

import { Loader2Icon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteWorkspaceAction } from "../server/actions";

export function DeleteWorkspaceDialog({
  workspace,
}: {
  workspace: { name: string; slug: string };
}) {
  const [confirmName, setConfirmName] = useState("");
  const [open, setOpen] = useState(false);
  const { execute, isPending, result, reset } = useAction(deleteWorkspaceAction, {
    onNavigation: () => setOpen(false),
  });

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setConfirmName("");
          reset();
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Delete workspace</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {workspace.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the workspace, its members and invitations, and everything in
            it. It can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="confirm-workspace-name">
            Type <span className="font-semibold">{workspace.name}</span> to confirm
          </Label>
          <Input
            id="confirm-workspace-name"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            autoComplete="off"
          />
          {result.serverError ? (
            <p className="text-sm text-destructive">{result.serverError.message}</p>
          ) : null}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={confirmName !== workspace.name || isPending}
            onClick={() => execute({ slug: workspace.slug, confirmName })}
          >
            {isPending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : null}
            Delete workspace
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
