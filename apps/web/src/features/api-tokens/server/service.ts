import "server-only";
import { AppError } from "@tracklane/core";
import { db } from "@tracklane/db";
import { generateApiToken } from "@/server/api/tokens";
import { assertWorkspacePermission } from "@/server/authz";

const MAX_TOKENS = 20;

/** The person's own tokens in a workspace (never the secret). */
export function listApiTokens(workspaceId: string, userId: string) {
  return db.apiToken.findMany({
    where: { workspaceId, userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      scope: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
  });
}

/** Creates a token and returns it once; only its hash is kept. */
export async function createApiToken(input: {
  workspaceId: string;
  userId: string;
  name: string;
  scope: "read" | "write";
  expiresInDays: number | null;
}) {
  // Viewers can read; writing needs a role that can edit issues.
  await assertWorkspacePermission(
    input.workspaceId,
    input.userId,
    input.scope === "write" ? "issues:update" : "projects:read",
  );
  const count = await db.apiToken.count({
    where: { workspaceId: input.workspaceId, userId: input.userId, revokedAt: null },
  });
  if (count >= MAX_TOKENS)
    throw new AppError("conflict", `You can have at most ${MAX_TOKENS} tokens. Revoke one first.`);
  const { token, prefix, hash } = generateApiToken();
  await db.apiToken.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      name: input.name,
      scope: input.scope,
      prefix,
      tokenHash: hash,
      expiresAt: input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 86_400_000)
        : null,
    },
  });
  return { token };
}

export async function revokeApiToken(workspaceId: string, userId: string, tokenId: string) {
  const { count } = await db.apiToken.updateMany({
    where: { id: tokenId, workspaceId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (!count) throw new AppError("not_found", "Token not found");
}
