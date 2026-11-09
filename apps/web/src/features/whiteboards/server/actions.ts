"use server";

import type { Route } from "next";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getWorkspaceAccess } from "@/server/authz";
import { authActionClient } from "@/server/safe-action";
import {
  createWhiteboard,
  deleteWhiteboard,
  renameWhiteboard,
  saveWhiteboardScene,
} from "./service";

const name = z.string().trim().min(1, "Name the board").max(120);

export const createWhiteboardAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), name, projectId: z.string().nullable() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    return createWhiteboard({ ...parsedInput, workspaceId: workspace.id, userId: ctx.user.id });
  });

export const saveWhiteboardAction = authActionClient
  .inputSchema(
    z.object({
      slug: z.string(),
      id: z.string(),
      scene: z.object({
        elements: z.array(z.record(z.string(), z.unknown())).max(20_000),
        viewBackgroundColor: z.string().max(40).optional(),
      }),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    await saveWhiteboardScene({ ...parsedInput, workspaceId: workspace.id, userId: ctx.user.id });
    return { savedAt: new Date().toISOString() };
  });

export const renameWhiteboardAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), id: z.string(), name }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    await renameWhiteboard(workspace.id, ctx.user.id, parsedInput.id, parsedInput.name);
    refresh();
  });

export const deleteWhiteboardAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), id: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    await deleteWhiteboard(workspace.id, ctx.user.id, parsedInput.id);
    redirect(`/${parsedInput.slug}/whiteboards` as Route);
  });
