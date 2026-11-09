"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getWorkspaceAccess } from "@/server/authz";
import { authActionClient } from "@/server/safe-action";
import { createApiToken, revokeApiToken } from "./service";

export const createApiTokenAction = authActionClient
  .inputSchema(
    z.object({
      slug: z.string(),
      name: z.string().trim().min(1, "Name the token").max(80),
      scope: z.enum(["read", "write"]),
      expiresInDays: z.number().int().min(1).max(365).nullable(),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    const result = await createApiToken({
      ...parsedInput,
      workspaceId: workspace.id,
      userId: ctx.user.id,
    });
    refresh();
    return result;
  });

export const revokeApiTokenAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), tokenId: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    await revokeApiToken(workspace.id, ctx.user.id, parsedInput.tokenId);
    refresh();
  });
