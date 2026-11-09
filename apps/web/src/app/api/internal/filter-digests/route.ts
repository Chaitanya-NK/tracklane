import { NextResponse } from "next/server";
import { sendDueFilterDigests } from "@/features/search/server/digests";
import { isInternalRequest } from "@/server/internal";

/** Called by the worker hourly. */
export async function POST(request: Request) {
  if (!(await isInternalRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ sent: await sendDueFilterDigests() });
}
