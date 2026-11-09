"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getWorkspaceAccess } from "@/server/authz";
import { authActionClient } from "@/server/safe-action";
import {
  createResolution,
  deleteResolution,
  reorderResolutions,
  setDefaultResolution,
  updateResolution,
} from "./service";

const fields = {
  name: z.string().trim().min(1, "Name the resolution").max(40),
  description: z.string().trim().max(200),
};

async function scope(slug: string, userId: string) {
  const { workspace } = await getWorkspaceAccess(slug);
  return { workspaceId: workspace.id, userId };
}

export const createResolutionAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), ...fields }))
  .action(async ({ parsedInput: { slug, ...rest }, ctx }) => {
    const result = await createResolution({ ...(await scope(slug, ctx.user.id)), ...rest });
    refresh();
    return result;
  });

export const updateResolutionAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), resolutionId: z.string(), ...fields }))
  .action(async ({ parsedInput: { slug, ...rest }, ctx }) => {
    const result = await updateResolution({ ...(await scope(slug, ctx.user.id)), ...rest });
    refresh();
    return result;
  });

export const setDefaultResolutionAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), resolutionId: z.string() }))
  .action(async ({ parsedInput: { slug, resolutionId }, ctx }) => {
    await setDefaultResolution({ ...(await scope(slug, ctx.user.id)), resolutionId });
    refresh();
  });

export const reorderResolutionsAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), resolutionIds: z.array(z.string()).max(50) }))
  .action(async ({ parsedInput: { slug, resolutionIds }, ctx }) => {
    await reorderResolutions({ ...(await scope(slug, ctx.user.id)), resolutionIds });
    refresh();
  });

export const deleteResolutionAction = authActionClient
  .inputSchema(
    z.object({ slug: z.string(), resolutionId: z.string(), replacementId: z.string().optional() }),
  )
  .action(async ({ parsedInput: { slug, ...rest }, ctx }) => {
    const result = await deleteResolution({ ...(await scope(slug, ctx.user.id)), ...rest });
    refresh();
    return result;
  });
