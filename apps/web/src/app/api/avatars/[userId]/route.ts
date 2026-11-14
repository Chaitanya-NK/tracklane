import { NextResponse } from "next/server";
import { getAvatarKey, sharesWorkspace } from "@/features/people/server";
import { getCurrentUser } from "@/server/auth";
import { storage } from "@/server/storage";

const notFound = () =>
  NextResponse.json({ error: { code: "not_found", message: "No photo" } }, { status: 404 });

/** A profile photo, for people who share a workspace with its owner. */
export async function GET(_request: Request, ctx: RouteContext<"/api/avatars/[userId]">) {
  const viewer = await getCurrentUser();
  if (!viewer) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Sign in first" } },
      { status: 401 },
    );
  }
  const { userId } = await ctx.params;
  if (!(await sharesWorkspace(viewer.id, userId))) return notFound();
  const key = await getAvatarKey(userId);
  const object = key ? await storage().get(key) : null;
  if (!object) return notFound();
  return new Response(object.stream, {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(object.size),
      "X-Content-Type-Options": "nosniff",
      // The URL changes with every upload, so it can be cached for a long time.
      "Cache-Control": "private, max-age=604800, immutable",
    },
  });
}
