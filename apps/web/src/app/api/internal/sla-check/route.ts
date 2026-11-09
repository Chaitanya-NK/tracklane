import { NextResponse } from "next/server";
import { checkSlas } from "@/features/sla/server/evaluate";
import { isInternalRequest } from "@/server/internal";

/** Called by the worker every few minutes. */
export async function POST(request: Request) {
  if (!(await isInternalRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const notified = await checkSlas();
  return NextResponse.json({ notified });
}
