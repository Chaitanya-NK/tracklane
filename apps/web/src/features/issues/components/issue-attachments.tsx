"use client";

import { TimeAgo } from "@/components/shared/time-ago";
import { DownloadIcon, FileIcon, Loader2Icon, PaperclipIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { deleteAttachmentAction } from "../server/actions";

export interface AttachmentItem {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  createdAt: Date;
  uploader: { id: string; name: string } | null;
}

const PREVIEWABLE = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"]);

export function IssueAttachments({
  issueId,
  attachments,
  canUpload,
  canDeleteAny,
  currentUserId,
  maxUploadMb,
}: {
  issueId: string;
  attachments: AttachmentItem[];
  canUpload: boolean;
  canDeleteAny: boolean;
  currentUserId: string;
  maxUploadMb: number;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [dragging, setDragging] = useState(false);
  const remove = useAction(deleteAttachmentAction, {
    onError: ({ error }) => toast.error(error.serverError?.message ?? "Couldn't remove the file"),
  });

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    const tooBig = list.filter((f) => f.size > maxUploadMb * 1024 * 1024);
    if (tooBig.length)
      toast.error(`${tooBig.map((f) => f.name).join(", ")}: larger than ${maxUploadMb} MB`);
    const ok = list.filter((f) => f.size <= maxUploadMb * 1024 * 1024);
    if (!ok.length) return;
    setUploading((n) => n + ok.length);
    await Promise.all(
      ok.map(async (file) => {
        const body = new FormData();
        body.append("file", file);
        try {
          const res = await fetch(`/api/issues/${issueId}/attachments`, { method: "POST", body });
          if (!res.ok) {
            const payload = (await res.json().catch(() => null)) as {
              error?: { message?: string };
            } | null;
            toast.error(`${file.name}: ${payload?.error?.message ?? "upload failed"}`);
          }
        } catch {
          toast.error(`${file.name}: upload failed`);
        } finally {
          setUploading((n) => n - 1);
        }
      }),
    );
    router.refresh();
  }

  return (
    <section
      aria-labelledby="attachments-heading"
      className={cn("space-y-3 rounded-lg", dragging && "bg-primary/5 ring-2 ring-primary/40")}
      onDragOver={(e) => {
        if (!canUpload || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (!canUpload) return;
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length) void upload(e.dataTransfer.files);
      }}
    >
      <div className="flex items-center justify-between">
        <h2 id="attachments-heading" className="text-sm font-semibold">
          Attachments{" "}
          {attachments.length ? (
            <span className="font-normal text-muted-foreground">({attachments.length})</span>
          ) : null}
        </h2>
        {canUpload ? (
          <>
            <input
              ref={input}
              type="file"
              multiple
              className="sr-only"
              aria-label="Upload attachments"
              onChange={(e) => {
                if (e.target.files?.length) void upload(e.target.files);
                e.target.value = "";
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => input.current?.click()}
              disabled={uploading > 0}
            >
              {uploading > 0 ? (
                <Loader2Icon className="animate-spin" aria-hidden="true" />
              ) : (
                <PaperclipIcon aria-hidden="true" />
              )}
              {uploading > 0 ? "Uploading…" : "Attach"}
            </Button>
          </>
        ) : null}
      </div>

      {attachments.length === 0 ? (
        canUpload ? (
          <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
            Drop files here or use Attach. Up to {maxUploadMb} MB each.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No attachments.</p>
        )
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {attachments.map((a) => {
            const url = `/api/attachments/${a.id}`;
            const canDelete = canDeleteAny || (canUpload && a.uploader?.id === currentUserId);
            return (
              <li key={a.id} className="group overflow-hidden rounded-lg border">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener"
                  className="flex h-28 items-center justify-center bg-muted"
                >
                  {PREVIEWABLE.has(a.contentType) ? (
                    // eslint-disable-next-line @next/next/no-img-element -- authenticated, streamed by our API
                    <img
                      src={url}
                      alt={a.filename}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <FileIcon className="size-8 text-muted-foreground" aria-hidden="true" />
                  )}
                </a>
                <div className="flex items-center gap-1 p-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={a.filename}>
                      {a.filename}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(a.size)} · <TimeAgo date={a.createdAt} />
                    </p>
                  </div>
                  <Button asChild variant="ghost" size="icon" className="size-7">
                    <a href={`${url}?download`} aria-label={`Download ${a.filename}`}>
                      <DownloadIcon aria-hidden="true" />
                    </a>
                  </Button>
                  {canDelete ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 hover:text-destructive"
                      aria-label={`Remove ${a.filename}`}
                      disabled={remove.isPending}
                      onClick={() => {
                        if (window.confirm(`Remove ${a.filename}?`))
                          remove.execute({ attachmentId: a.id });
                      }}
                    >
                      <Trash2Icon aria-hidden="true" />
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
