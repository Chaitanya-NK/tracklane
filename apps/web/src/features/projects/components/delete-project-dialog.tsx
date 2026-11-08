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
import { deleteProjectAction } from "../server/actions";

export function DeleteProjectDialog({
  slug,
  project,
}: {
  slug: string;
  project: { key: string; name: string };
}) {
  const [confirmKey, setConfirmKey] = useState("");
  const [open, setOpen] = useState(false);
  const { execute, isPending, result, reset } = useAction(deleteProjectAction, {
    onNavigation: () => setOpen(false),
  });
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setConfirmKey("");
          reset();
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Delete project</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {project.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Every issue, comment and attachment in this project is deleted permanently.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="confirm-project-key">
            Type <span className="font-mono font-semibold">{project.key}</span> to confirm
          </Label>
          <Input
            id="confirm-project-key"
            value={confirmKey}
            onChange={(e) => setConfirmKey(e.target.value)}
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
            disabled={confirmKey.trim().toUpperCase() !== project.key || isPending}
            onClick={() => execute({ slug, projectKey: project.key, confirmKey })}
          >
            {isPending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : null}
            Delete project
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
