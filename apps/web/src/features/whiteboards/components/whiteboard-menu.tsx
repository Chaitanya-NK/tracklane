"use client";

import { MoreHorizontalIcon } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { deleteWhiteboardAction, renameWhiteboardAction } from "../server/actions";

/** Title (renamable inline) and the board's actions. */
export function WhiteboardTitle({
  slug,
  id,
  name,
  canEdit,
}: {
  slug: string;
  id: string;
  name: string;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [deleting, setDeleting] = useState(false);
  const rename = useAction(renameWhiteboardAction);
  const remove = useAction(deleteWhiteboardAction);

  async function commit() {
    setEditing(false);
    if (!value.trim() || value === name) return setValue(name);
    const res = await rename.executeAsync({ slug, id, name: value });
    if (res?.serverError) toast.error(res.serverError.message);
  }

  return (
    <div className="flex min-w-0 items-center gap-1">
      {editing ? (
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") void commit();
            if (e.key === "Escape") {
              setValue(name);
              setEditing(false);
            }
          }}
          aria-label="Whiteboard name"
          className="h-8 w-64"
          autoFocus
          maxLength={120}
        />
      ) : (
        <h1 className="truncate text-lg font-semibold">{value}</h1>
      )}
      {canEdit ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" aria-label="Whiteboard actions">
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => setEditing(true)}>Rename</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${name}?`}
        description="Everyone loses access to the drawing."
        pending={remove.isPending}
        onConfirm={async () => {
          const res = await remove.executeAsync({ slug, id });
          if (res?.serverError) toast.error(res.serverError.message);
        }}
      />
    </div>
  );
}
