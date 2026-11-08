import { checkDatabase } from "@tracklane/db";
import { connection, NextResponse } from "next/server";

/** Liveness/readiness probe used by the dev container, CI and (later) Docker healthchecks. */
export async function GET() {
  await connection();
  const database = await checkDatabase();
  return NextResponse.json(
    { ok: database.ok, service: "web", database },
    { status: database.ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
