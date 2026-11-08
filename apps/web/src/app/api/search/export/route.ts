import { NextResponse } from "next/server";
import { issuesToCsv, searchIssues } from "@/features/search/server";
import { getCurrentUser } from "@/server/auth";
import { getWorkspaceAccess } from "@/server/authz";

const MAX_EXPORT = 5000;

/** GET /api/search/export?workspace=acme&q=<TQL> → CSV of matching issues (first 5,000). */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Sign in first" } },
      { status: 401 },
    );
  const url = new URL(request.url);
  const slug = url.searchParams.get("workspace") ?? "";
  const { workspace } = await getWorkspaceAccess(slug);
  const result = await searchIssues({
    workspaceId: workspace.id,
    userId: user.id,
    query: url.searchParams.get("q") ?? "",
    pageSize: MAX_EXPORT,
  });
  if (!result.ok)
    return NextResponse.json(
      { error: { code: "validation_failed", message: result.error.message } },
      { status: 400 },
    );
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(issuesToCsv(result.issues), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${workspace.slug}-issues-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
