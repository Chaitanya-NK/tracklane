import { isAppError } from "@tracklane/core";
import { NextResponse } from "next/server";
import { getReadableAttachment, isInlineSafe } from "@/features/issues/server";
import { getCurrentUser } from "@/server/auth";
import { storage } from "@/server/storage";

/** Streams an attachment to a workspace member. Only raster images are shown inline. */
export async function GET(request: Request, ctx: RouteContext<"/api/attachments/[attachmentId]">) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Sign in first" } },
      { status: 401 },
    );
  const { attachmentId } = await ctx.params;

  try {
    const attachment = await getReadableAttachment(attachmentId, user.id);
    const object = await storage().get(attachment.storageKey);
    if (!object)
      return NextResponse.json(
        { error: { code: "not_found", message: "File is missing" } },
        { status: 404 },
      );

    const download = new URL(request.url).searchParams.has("download");
    const inline = isInlineSafe(attachment.contentType) && !download;
    const encoded = encodeURIComponent(attachment.filename);
    return new Response(object.stream, {
      headers: {
        "Content-Type": inline ? attachment.contentType : "application/octet-stream",
        "Content-Length": String(object.size),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encoded}`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    if (isAppError(error))
      return NextResponse.json({ error: error.toJSON() }, { status: error.httpStatus });
    throw error;
  }
}
