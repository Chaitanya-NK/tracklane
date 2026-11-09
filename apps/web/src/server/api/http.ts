import "server-only";
import { AppError, can, isAppError, type Permission, type WorkspaceRole } from "@tracklane/core";
import { db } from "@tracklane/db";
import { after, NextResponse } from "next/server";
import type { z } from "zod";
import { hashApiToken } from "./tokens";

export interface ApiContext {
  user: { id: string; name: string; email: string };
  workspace: { id: string; slug: string; name: string };
  role: WorkspaceRole;
  scope: "read" | "write";
  tokenId: string;
}

const WINDOW_MS = 60_000;
const LIMIT = 300;
const hits = new Map<string, { start: number; count: number }>();

/** Fixed-window limit per token (per server instance): 300 requests a minute. */
function rateLimit(tokenId: string) {
  const now = Date.now();
  const entry = hits.get(tokenId);
  if (!entry || now - entry.start > WINDOW_MS) {
    hits.set(tokenId, { start: now, count: 1 });
    return { remaining: LIMIT - 1, reset: now + WINDOW_MS };
  }
  entry.count++;
  if (entry.count > LIMIT) {
    throw new AppError("rate_limited", "Too many requests. Wait a minute and try again.");
  }
  return { remaining: LIMIT - entry.count, reset: entry.start + WINDOW_MS };
}

/** Resolves `Authorization: Bearer tl_…` to a user, workspace and role. */
export async function authenticate(
  request: Request,
): Promise<ApiContext & { limit: { remaining: number; reset: number } }> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(tl_[A-Za-z0-9_-]{20,})$/.exec(header.trim());
  if (!match) throw new AppError("unauthorized", "Send an API token: Authorization: Bearer tl_…");
  const token = await db.apiToken.findUnique({
    where: { tokenHash: hashApiToken(match[1]!) },
    select: {
      id: true,
      scope: true,
      revokedAt: true,
      expiresAt: true,
      lastUsedAt: true,
      user: { select: { id: true, name: true, email: true } },
      workspace: { select: { id: true, slug: true, name: true } },
      workspaceId: true,
      userId: true,
    },
  });
  if (!token || token.revokedAt || (token.expiresAt && token.expiresAt < new Date())) {
    throw new AppError("unauthorized", "This token is invalid, expired or revoked");
  }
  const member = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: token.workspaceId, userId: token.userId } },
    select: { role: true },
  });
  if (!member)
    throw new AppError("unauthorized", "The token's owner is no longer in this workspace");
  const limit = rateLimit(token.id);
  // Record use at most once a minute.
  if (!token.lastUsedAt || Date.now() - token.lastUsedAt.getTime() > 60_000) {
    await db.apiToken.update({ where: { id: token.id }, data: { lastUsedAt: new Date() } });
  }
  return {
    user: token.user,
    workspace: token.workspace,
    role: member.role,
    scope: token.scope,
    tokenId: token.id,
    limit,
  };
}

export function requireWrite(ctx: ApiContext, permission: Permission) {
  if (ctx.scope !== "write") throw new AppError("forbidden", "This token is read-only");
  if (!can(ctx.role, permission)) throw new AppError("forbidden", "Your role can't do that");
}

export async function parseBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.infer<T>> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw new AppError("validation_failed", "Send a JSON body");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    throw new AppError("validation_failed", `${issue.path.join(".") || "body"}: ${issue.message}`, {
      field: issue.path.join(".") || undefined,
    });
  }
  return parsed.data;
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

/**
 * Wraps a v1 handler: authentication, JSON errors with the right status, rate-limit headers.
 * Tokens (not cookies) authenticate, so cross-origin calls are safe to allow.
 */
export function apiHandler<P>(
  handler: (
    request: Request,
    ctx: ApiContext,
    params: P,
  ) => Promise<{ data: unknown; status?: number; meta?: unknown }>,
) {
  return async (request: Request, route: { params: Promise<P> }) => {
    let limitHeaders: Record<string, string> = {};
    const started = performance.now();
    let logged: { workspaceId: string; tokenId: string } | null = null;
    const log = (status: number) => {
      if (!logged) return;
      const entry = {
        ...logged,
        method: request.method,
        path: new URL(request.url).pathname.replace(/^\/api\/v1/, "").slice(0, 200) || "/",
        status,
        durationMs: Math.round(performance.now() - started),
      };
      after(() => db.apiRequestLog.create({ data: entry }).catch(() => undefined));
    };
    try {
      const ctx = await authenticate(request);
      logged = { workspaceId: ctx.workspace.id, tokenId: ctx.tokenId };
      limitHeaders = {
        "x-ratelimit-limit": String(LIMIT),
        "x-ratelimit-remaining": String(ctx.limit.remaining),
        "x-ratelimit-reset": String(Math.ceil(ctx.limit.reset / 1000)),
      };
      const result = await handler(request, ctx, await route.params);
      log(result.status ?? 200);
      if (result.status === 204)
        return new NextResponse(null, { status: 204, headers: { ...CORS, ...limitHeaders } });
      return NextResponse.json(
        { data: result.data, ...(result.meta ? { meta: result.meta } : {}) },
        { status: result.status ?? 200, headers: { ...CORS, ...limitHeaders } },
      );
    } catch (error) {
      if (isAppError(error)) {
        log(error.httpStatus);
        return NextResponse.json(
          { error: error.toJSON() },
          { status: error.httpStatus, headers: { ...CORS, ...limitHeaders } },
        );
      }
      console.error("API error", error);
      log(500);
      return NextResponse.json(
        { error: { code: "internal", message: "Something went wrong" } },
        { status: 500, headers: CORS },
      );
    }
  };
}

export const preflight = () => new NextResponse(null, { status: 204, headers: CORS });
