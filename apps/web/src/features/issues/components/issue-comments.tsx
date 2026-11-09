"use client";

import { SmilePlusIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useState } from "react";
import { TimeAgo } from "@/components/shared/time-ago";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Markdown } from "@/components/shared/markdown";
import { MarkdownEditor, type MentionUser } from "@/components/shared/markdown-editor";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isBareShortcut } from "@/lib/keyboard";
import { cn } from "@/lib/utils";
import { type Reaction, REACTIONS } from "../reactions";
import {
  addCommentAction,
  deleteCommentAction,
  toggleReactionAction,
  updateCommentAction,
} from "../server/actions";

export interface CommentItem {
  id: string;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  parentId: string | null;
  author: { id: string; name: string; image: string | null } | null;
  reactions: { emoji: string; count: number; mine: boolean; names: string[] }[];
}

function Reactions({ comment, canReact }: { comment: CommentItem; canReact: boolean }) {
  const [open, setOpen] = useState(false);
  const toggle = useAction(toggleReactionAction, {
    onError: ({ error }) => toast.error(error.serverError?.message ?? "Couldn't react"),
  });
  const react = (emoji: Reaction) => toggle.execute({ commentId: comment.id, emoji });
  if (!canReact && comment.reactions.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {comment.reactions.map((r) => (
        <Tooltip key={r.emoji}>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled={!canReact || toggle.isPending}
              aria-pressed={r.mine}
              aria-label={`${r.emoji} ${r.count}, ${r.mine ? "remove your reaction" : "react"}`}
              onClick={() => react(r.emoji as Reaction)}
              className={cn(
                "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs tabular-nums transition-colors",
                r.mine
                  ? "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100"
                  : "bg-background hover:bg-muted",
              )}
            >
              <span aria-hidden="true">{r.emoji}</span>
              {r.count}
            </button>
          </TooltipTrigger>
          <TooltipContent>{r.names.join(", ")}</TooltipContent>
        </Tooltip>
      ))}
      {canReact ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="size-6 text-muted-foreground">
              <SmilePlusIcon aria-hidden="true" />
              <span className="sr-only">Add a reaction</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="flex w-auto gap-1 p-1" align="start">
            {REACTIONS.map((emoji) => (
              <Button
                key={emoji}
                variant="ghost"
                size="icon"
                className="size-8 text-base"
                aria-label={`React with ${emoji}`}
                onClick={() => {
                  setOpen(false);
                  react(emoji);
                }}
              >
                {emoji}
              </Button>
            ))}
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}

function ReplyBox({
  issueId,
  parentId,
  mentionUsers,
  onDone,
}: {
  issueId: string;
  parentId: string;
  mentionUsers: MentionUser[];
  onDone: () => void;
}) {
  const [body, setBody] = useState("");
  const add = useAction(addCommentAction, {
    onSuccess: () => {
      setBody("");
      onDone();
      toast.success("Reply added");
    },
    onError: ({ error }) => toast.error(error.serverError?.message ?? "Couldn't reply"),
  });
  const submit = () => body.trim() && add.execute({ issueId, body, parentId });
  return (
    <div className="space-y-2">
      <MarkdownEditor
        value={body}
        onChange={setBody}
        rows={2}
        autoFocus
        placeholder="Reply… (Ctrl+Enter to send)"
        mentionUsers={mentionUsers}
        onSubmit={submit}
        id={`reply-${parentId}`}
        aria-label="Reply"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={add.isPending || !body.trim()}>
          {add.isPending ? <Spinner /> : null}
          Reply
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function Comment({
  comment,
  canManage,
  canReact,
  onReply,
  mentionUsers,
  children,
}: {
  comment: CommentItem;
  canManage: boolean;
  canReact: boolean;
  onReply?: () => void;
  mentionUsers: MentionUser[];
  children?: React.ReactNode;
}) {
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
              mentionUsers={mentionUsers}
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
        {!editing ? <Reactions comment={comment} canReact={canReact} /> : null}
        {(canManage || onReply) && !editing ? (
          <div className="-ml-2 flex gap-1">
            {onReply ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground"
                onClick={onReply}
              >
                Reply
              </Button>
            ) : null}
            {canManage ? (
              <>
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
              </>
            ) : null}
          </div>
        ) : null}
        {children}
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
  mentionUsers = [],
}: {
  issueId: string;
  comments: CommentItem[];
  currentUser: { id: string; name: string; image: string | null };
  canComment: boolean;
  canModerate: boolean;
  /** Workspace members offered after typing @. */
  mentionUsers?: MentionUser[];
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
  const [replyTo, setReplyTo] = useState<string | null>(null);

  // M jumps to the comment box.
  useEffect(() => {
    if (!canComment) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "m" || !isBareShortcut(event)) return;
      const box = document.getElementById("new-comment");
      if (!box || !box.checkVisibility()) return;
      event.preventDefault();
      box.scrollIntoView({ block: "center", behavior: "smooth" });
      box.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [canComment]);

  const threads = comments.filter((c) => !c.parentId).reverse();
  const replies = (id: string) => comments.filter((c) => c.parentId === id);
  const canManage = (c: CommentItem) =>
    canModerate || (canComment && c.author?.id === currentUser.id);

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
              placeholder="Add a comment… (M to jump here, @ to mention, Ctrl+Enter to send)"
              onSubmit={submit}
              mentionUsers={mentionUsers}
              id="new-comment"
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
          {threads.map((comment) => {
            const thread = replies(comment.id);
            return (
              <Comment
                mentionUsers={mentionUsers}
                key={comment.id}
                comment={comment}
                canManage={canManage(comment)}
                canReact={canComment}
                onReply={canComment ? () => setReplyTo(comment.id) : undefined}
              >
                {thread.length || replyTo === comment.id ? (
                  <ol
                    className="mt-3 space-y-4 border-l-2 pl-4"
                    aria-label={`Replies to ${comment.author?.name ?? "comment"}`}
                  >
                    {thread.map((reply) => (
                      <Comment
                        key={reply.id}
                        mentionUsers={mentionUsers}
                        comment={reply}
                        canManage={canManage(reply)}
                        canReact={canComment}
                        onReply={canComment ? () => setReplyTo(comment.id) : undefined}
                      />
                    ))}
                    {replyTo === comment.id ? (
                      <li>
                        <ReplyBox
                          issueId={issueId}
                          parentId={comment.id}
                          mentionUsers={mentionUsers}
                          onDone={() => setReplyTo(null)}
                        />
                      </li>
                    ) : null}
                  </ol>
                ) : null}
              </Comment>
            );
          })}
        </ol>
      )}
    </div>
  );
}
