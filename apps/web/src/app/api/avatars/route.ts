import { isAppError } from "@tracklane/core";
import { NextResponse } from "next/server";
import { setAvatar } from "@/features/people/server";
import { getCurrentUser } from "@/server/auth";

/** Replace your profile photo (multipart field "file"). */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Sign in first" } },
      { status: 401 },
    );
  }
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
    const result = await setAvatar(user.id, {
      type: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.toJSON() }, { status: error.httpStatus });
    }
    console.error("Avatar upload failed:", error);
    return NextResponse.json(
      { error: { code: "internal", message: "Upload failed" } },
      { status: 500 },
    );
  }
}
