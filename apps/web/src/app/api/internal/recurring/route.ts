import { NextResponse } from "next/server";
import { runDueRecurringIssues } from "@/features/recurring/server/service";
import { isInternalRequest } from "@/server/internal";

/** Called by the worker hourly. */
export async function POST(request: Request) {
  if (!(await isInternalRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ created: await runDueRecurringIssues() });
}
