"use client";

import { TimeAgo } from "@/components/shared/time-ago";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Markdown } from "@/components/shared/markdown";
import { MarkdownEditor } from "@/components/shared/markdown-editor";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { addCommentAction, deleteCommentAction, updateCommentAction } from "../server/actions";
import { Spinner } from "@/components/ui/spinner";

export interface CommentItem {
  id: string;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  author: { id: string; name: string; image: string | null } | null;
}

function Comment({ comment, canManage }: { comment: CommentItem; canManage: boolean }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(comment.body);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const update = useAction(updateCommentAction, {
    onSuccess: () => {
      setEditing(false);
      toast.success("Comment updated");
    },
    onError: ({ error }) => toast.error(error.serverError?.message ?? "Couldn't save the comment"),
  });
  const remove = useAction(deleteCommentAction, {
    onSuccess: () => {
      setConfirmDelete(false);
      toast.success("Comment deleted");
    },
    onError: ({ error }) =>
      toast.error(error.serverError?.message ?? "Couldn't delete the comment"),
  });

  return (
    <li className="flex gap-3">
      <UserAvatar user={comment.author ?? { name: "?" }} className="mt-0.5 size-8" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm">
          <span className="font-medium">{comment.author?.name ?? "Former member"}</span>{" "}
          <TimeAgo date={comment.createdAt} className="text-muted-foreground" />
          {comment.editedAt ? <span className="text-muted-foreground"> · edited</span> : null}
        </p>
        {editing ? (
          <div className="space-y-2">
            <MarkdownEditor
              value={body}
              onChange={setBody}
              rows={4}
              autoFocus
              aria-label="Edit comment"
              onSubmit={() => update.execute({ commentId: comment.id, body })}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={update.isPending || !body.trim()}
                onClick={() => update.execute({ commentId: comment.id, body })}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => (setBody(comment.body), setEditing(false))}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Markdown>{comment.body}</Markdown>
        )}
        {canManage && !editing ? (
          <div className="-ml-2 flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground"
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </Button>
            <ConfirmDialog
              open={confirmDelete}
              onOpenChange={setConfirmDelete}
              title="Delete this comment?"
              description="This can't be undone."
              pending={remove.isPending}
              onConfirm={() => remove.execute({ commentId: comment.id })}
            />
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function IssueComments({
  issueId,
  comments,
  currentUser,
  canComment,
  canModerate,
}: {
  issueId: string;
  comments: CommentItem[];
  currentUser: { id: string; name: string; image: string | null };
  canComment: boolean;
  canModerate: boolean;
}) {
  const [body, setBody] = useState("");
  const add = useAction(addCommentAction, {
    onSuccess: () => {
      setBody("");
      toast.success("Comment added");
    },
    onError: ({ error }) => toast.error(error.serverError?.message ?? "Couldn't add the comment"),
  });
  const submit = () => body.trim() && add.execute({ issueId, body });

  return (
    <div className="space-y-6">
      {canComment ? (
        <div className="flex gap-3">
          <UserAvatar user={currentUser} className="mt-0.5 size-8" />
          <div className="flex-1 space-y-2">
            <MarkdownEditor
              value={body}
              onChange={setBody}
              rows={3}
              placeholder="Add a comment… (Ctrl+Enter to send)"
              onSubmit={submit}
              aria-label="New comment"
            />
            {body.trim() ? (
              <Button size="sm" onClick={submit} disabled={add.isPending}>
                {add.isPending ? <Spinner /> : null}
                Comment
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ol className="space-y-5">
          {[...comments].reverse().map((comment) => (
            <Comment
              key={comment.id}
              comment={comment}
              canManage={canModerate || (canComment && comment.author?.id === currentUser.id)}
            />
          ))}
        </ol>
      )}
    </div>
  );
}
