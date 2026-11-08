"use client";

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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { deleteWorkspaceAction } from "../server/actions";
import { Spinner } from "@/components/ui/spinner";

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
        <Field>
          <FieldLabel htmlFor="confirm-workspace-name">
            Type <span className="font-semibold">{workspace.name}</span> to confirm
          </FieldLabel>
          <Input
            id="confirm-workspace-name"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            autoComplete="off"
          />
          {result.serverError ? <FieldError>{result.serverError.message}</FieldError> : null}
        </Field>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={confirmName !== workspace.name || isPending}
            onClick={() => execute({ slug: workspace.slug, confirmName })}
          >
            {isPending ? <Spinner /> : null}
            Delete workspace
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
