"use client";

import {
  ExternalLinkIcon,
  LinkIcon,
  MoreHorizontalIcon,
  Trash2Icon,
  UserRoundCheckIcon,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { bulkDeleteAction, bulkUpdateAction } from "@/features/search/server/actions";

/** Per-row "…" menu on the project list. */
export function RowActions({
  slug,
  issue,
  userId,
  canEdit,
  canDelete,
}: {
  slug: string;
  issue: { id: string; key: string; assigneeId: string | null };
  userId: string;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [confirm, setConfirm] = useState(false);
  const update = useAction(bulkUpdateAction, {
    onSuccess: () => toast.success(`${issue.key} assigned to you`),
    onError: ({ error }) => toast.error(error.serverError?.message ?? "Couldn't assign"),
  });
  const remove = useAction(bulkDeleteAction, {
    onSuccess: () => {
      setConfirm(false);
      toast.success(`${issue.key} deleted`);
    },
    onError: ({ error }) => toast.error(error.serverError?.message ?? "Couldn't delete"),
  });
  const href = `/${slug}/issues/${issue.key}`;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative z-10 size-7">
            <MoreHorizontalIcon aria-hidden="true" />
            <span className="sr-only">Actions for {issue.key}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={href as Route}>
              <ExternalLinkIcon aria-hidden="true" /> Open
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={async () => {
              try {
                await navigator.clipboard.writeText(`${window.location.origin}${href}`);
                toast.success("Link copied");
              } catch {
                toast.error("Couldn't copy the link");
              }
            }}
          >
            <LinkIcon aria-hidden="true" /> Copy link
          </DropdownMenuItem>
          {canEdit && issue.assigneeId !== userId ? (
            <DropdownMenuItem
              onSelect={() =>
                update.execute({ slug, issueIds: [issue.id], patch: { assigneeId: userId } })
              }
            >
              <UserRoundCheckIcon aria-hidden="true" /> Assign to me
            </DropdownMenuItem>
          ) : null}
          {canDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirm(true)}>
                <Trash2Icon aria-hidden="true" /> Delete
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete ${issue.key}?`}
        description="The issue, its comments and attachments are removed for good."
        pending={remove.isPending}
        onConfirm={() => remove.execute({ slug, issueIds: [issue.id] })}
      />
    </>
  );
}
