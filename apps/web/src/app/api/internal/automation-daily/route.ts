import { NextResponse } from "next/server";
import { runDailyAutomations } from "@/features/automation/server/engine";
import { isInternalRequest } from "@/server/internal";

/** Called by the worker once a day. */
export async function POST(request: Request) {
  if (!(await isInternalRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runDailyAutomations());
}
