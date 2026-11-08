"use client";

import { CopyIcon, LinkIcon, Loader2Icon, MoreHorizontalIcon, Trash2Icon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteIssueAction } from "../server/actions";

export function IssueActionsMenu({
  slug,
  issueId,
  issueKey,
  canDelete,
}: {
  slug: string;
  issueId: string;
  issueKey: string;
  canDelete: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const remove = useAction(deleteIssueAction, {
    onNavigation: () => setConfirming(false),
    onError: ({ error }) => toast.error(error.serverError?.message ?? "Couldn't delete the issue"),
  });

  const copy = async (text: string, what: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(`Copied ${what}`);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Issue actions">
            <MoreHorizontalIcon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => copy(window.location.href.split("?")[0]!, "link")}>
            <LinkIcon aria-hidden="true" /> Copy link
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => copy(issueKey, "key")}>
            <CopyIcon aria-hidden="true" /> Copy key
          </DropdownMenuItem>
          {canDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
                <Trash2Icon aria-hidden="true" /> Delete
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {issueKey}?</AlertDialogTitle>
            <AlertDialogDescription>
              The issue, its comments, attachments and history are deleted permanently. Subtasks
              stay but lose their parent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => remove.execute({ slug, issueId })}
            >
              {remove.isPending ? (
                <Loader2Icon className="animate-spin" aria-hidden="true" />
              ) : null}
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
