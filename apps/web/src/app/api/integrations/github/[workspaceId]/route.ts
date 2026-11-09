import { db } from "@tracklane/db";
import { NextResponse } from "next/server";
import {
  type GitHubConfig,
  handleGitHubEvent,
  verifyGitHubSignature,
} from "@/features/integrations/server";

/** POST /api/integrations/github/:workspaceId — GitHub repository webhook (JSON). */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/integrations/github/[workspaceId]">,
) {
  const { workspaceId } = await params;
  const integration = await db.integration.findUnique({
    where: { workspaceId_kind: { workspaceId, kind: "github" } },
    select: { secret: true, config: true, enabled: true },
  });
  if (!integration?.enabled || !integration.secret) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const body = await request.text();
  if (body.length > 5_000_000) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const valid = await verifyGitHubSignature(
    integration.secret,
    body,
    request.headers.get("x-hub-signature-256"),
  );
  if (!valid) return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const config = integration.config as unknown as GitHubConfig;
  const repo = (payload.repository as { full_name?: string } | undefined)?.full_name;
  if (repo && config.repo && repo.toLowerCase() !== config.repo.toLowerCase()) {
    return NextResponse.json({ ok: true, ignored: "other repository" });
  }
  const result = await handleGitHubEvent(
    workspaceId,
    config,
    request.headers.get("x-github-event") ?? "",
    payload,
  );
  return NextResponse.json(result);
}
