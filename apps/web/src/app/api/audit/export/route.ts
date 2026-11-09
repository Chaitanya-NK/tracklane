import { auditActionLabel, isAppError } from "@tracklane/core";
import { NextResponse } from "next/server";
import { exportAuditEvents, parseAuditFilters } from "@/features/audit/server";
import { csvField } from "@/features/search/server";
import { getCurrentUser } from "@/server/auth";
import { getWorkspaceAccess } from "@/server/authz";

/** GET /api/audit/export?workspace=acme[&category=…&actor=…&q=…&from=…&to=…] → CSV. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Sign in first" } },
      { status: 401 },
    );
  }
  const url = new URL(request.url);
  const { workspace } = await getWorkspaceAccess(url.searchParams.get("workspace") ?? "");
  let events: Awaited<ReturnType<typeof exportAuditEvents>>;
  try {
    events = await exportAuditEvents({
      workspaceId: workspace.id,
      userId: user.id,
      filters: parseAuditFilters(Object.fromEntries(url.searchParams.entries())),
    });
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 403 },
      );
    }
    throw error;
  }
  const rows = [
    ["Time (UTC)", "Actor", "Action", "Description", "Target", "Details", "IP", "User agent"],
    ...events.map((e) => [
      e.createdAt.toISOString(),
      e.actorName,
      e.action,
      auditActionLabel(e.action),
      e.targetLabel ?? "",
      JSON.stringify(e.metadata),
      e.ipAddress ?? "",
      e.userAgent ?? "",
    ]),
  ];
  const body = `${rows.map((r) => r.map(csvField).join(",")).join("\r\n")}\r\n`;
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="audit-${workspace.slug}-${date}.csv"`,
      "cache-control": "no-store",
    },
  });
}
