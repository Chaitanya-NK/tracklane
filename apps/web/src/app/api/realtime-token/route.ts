import { signRealtimeToken } from "@tracklane/core";
import { db } from "@tracklane/db";
import { NextResponse } from "next/server";
import { env } from "@/env";
import { getCurrentUser } from "@/server/auth/session";

/** A 10-minute token for the realtime connection (rooms limited to the user's workspaces). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const memberships = await db.workspaceMember.findMany({
    where: { userId: user.id },
    select: { workspaceId: true },
  });
  const token = await signRealtimeToken(
    {
      sub: user.id,
      name: user.name,
      image: user.image,
      ws: memberships.map((m) => m.workspaceId),
      exp: Math.floor(Date.now() / 1000) + 600,
    },
    env.BETTER_AUTH_SECRET,
  );
  return NextResponse.json({ token }, { headers: { "cache-control": "no-store" } });
}
