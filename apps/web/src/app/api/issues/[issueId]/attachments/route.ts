import { isAppError } from "@tracklane/core";
import { NextResponse } from "next/server";
import { uploadAttachment } from "@/features/issues/server";
import { getCurrentUser } from "@/server/auth";

/** Upload one file (multipart field "file") to an issue. */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/issues/[issueId]/attachments">,
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Sign in first" } },
      { status: 401 },
    );
  const { issueId } = await ctx.params;

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "Send the file as multipart form data" } },
      { status: 400 },
    );
  }
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "No file was sent" } },
      { status: 400 },
    );
  }

  try {
    const attachment = await uploadAttachment({ issueId, userId: user.id, file });
    return NextResponse.json({ data: attachment }, { status: 201 });
  } catch (error) {
    if (isAppError(error))
      return NextResponse.json({ error: error.toJSON() }, { status: error.httpStatus });
    console.error("Attachment upload failed:", error);
    return NextResponse.json(
      { error: { code: "internal", message: "Upload failed" } },
      { status: 500 },
    );
  }
}
