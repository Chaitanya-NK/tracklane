import "server-only";
import { randomUUID } from "node:crypto";
import { AppError } from "@tracklane/core";
import { db } from "@tracklane/db";
import { assertWorkspacePermission } from "@/server/authz";
import { MAX_UPLOAD_BYTES, storage } from "@/server/storage";
import { recordAttachment } from "./service";

/** Images the browser may display inline. SVG is excluded: it can carry scripts. */
const INLINE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"]);

export function isInlineSafe(contentType: string) {
  return INLINE_TYPES.has(contentType);
}

/** Keeps the original name readable while stripping path parts and control characters. */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f"]/g, "")
    .trim()
    .slice(0, 200);
  return cleaned || "file";
}

export async function uploadAttachment(input: { issueId: string; userId: string; file: File }) {
  const issue = await db.issue.findUnique({
    where: { id: input.issueId },
    select: { id: true, workspaceId: true },
  });
  if (!issue) throw new AppError("not_found", "Issue not found");
  await assertWorkspacePermission(issue.workspaceId, input.userId, "issues:update");
  if (input.file.size === 0) throw new AppError("validation_failed", "The file is empty");
  if (input.file.size > MAX_UPLOAD_BYTES) {
    throw new AppError(
      "validation_failed",
      `Files can be up to ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB`,
    );
  }

  const storageKey = `${issue.workspaceId}/${issue.id}/${randomUUID()}`;
  await storage().put(storageKey, new Uint8Array(await input.file.arrayBuffer()));
  try {
    return await recordAttachment({
      issueId: issue.id,
      userId: input.userId,
      filename: sanitizeFilename(input.file.name),
      contentType: input.file.type || "application/octet-stream",
      size: input.file.size,
      storageKey,
    });
  } catch (error) {
    await storage().delete(storageKey);
    throw error;
  }
}

/** Looks up an attachment the user is allowed to read. */
export async function getReadableAttachment(attachmentId: string, userId: string) {
  const attachment = await db.attachment.findUnique({
    where: { id: attachmentId },
    select: {
      filename: true,
      contentType: true,
      size: true,
      storageKey: true,
      issue: { select: { workspaceId: true } },
    },
  });
  if (!attachment) throw new AppError("not_found", "Attachment not found");
  await assertWorkspacePermission(attachment.issue.workspaceId, userId, "projects:read");
  return attachment;
}
