import { NextResponse } from "next/server";
import { getCycleTime, getSprintReport } from "@/features/reports/server";
import { csvField } from "@/features/search/server";
import { getCurrentUser } from "@/server/auth";
import { getProjectAccess } from "@/server/authz";

const csv = (rows: (string | number | null)[][]) =>
  `${rows.map((r) => r.map(csvField).join(",")).join("\r\n")}\r\n`;

/**
 * GET /api/reports/export?workspace=acme&project=WEB&report=cycle|sprint[&sprint=id] → CSV.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Sign in first" } },
      { status: 401 },
    );
  }
  const url = new URL(request.url);
  const { project } = await getProjectAccess(
    url.searchParams.get("workspace") ?? "",
    url.searchParams.get("project") ?? "",
  );
  const report = url.searchParams.get("report");
  let body: string;
  if (report === "cycle") {
    const { rows } = await getCycleTime(project.id, 90);
    body = csv([
      ["Key", "Summary", "Started", "Resolved", "Cycle time (days)"],
      ...rows.map((r) => [r.key, r.title, r.started, r.resolved, r.days]),
    ]);
  } else if (report === "sprint") {
    const data = await getSprintReport(project.id, url.searchParams.get("sprint") ?? "");
    if (!data) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Sprint not found" } },
        { status: 404 },
      );
    }
    body = csv([
      ["Sprint", data.name],
      ["Committed points", data.committed.points],
      ["Completed points", data.completed.points],
      ["Completed issues", data.completed.issues],
      [],
      ["Not completed", "Summary", "Status", "Points", "Assignee"],
      ...data.notCompleted.map((i) => [
        i.key,
        i.title,
        i.status.name,
        i.estimate,
        i.assignee?.name ?? "",
      ]),
    ]);
  } else {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "Unknown report" } },
      { status: 400 },
    );
  }
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${project.key}-${report}-report.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
