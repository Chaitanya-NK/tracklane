"use server";

import { workspaceNameSchema, workspaceSlugSchema } from "@tracklane/core";
import type { Route } from "next";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getWorkspaceAccess } from "@/server/authz";
import { authActionClient } from "@/server/safe-action";
import { createWorkspace, deleteWorkspace, updateWorkspace } from "./service";

export const createWorkspaceAction = authActionClient
  .inputSchema(z.object({ name: workspaceNameSchema, slug: workspaceSlugSchema }))
  .action(async ({ parsedInput, ctx }) => {
    const workspace = await createWorkspace({ ...parsedInput, userId: ctx.user.id });
    redirect(`/${workspace.slug}` as Route);
  });

export const updateWorkspaceAction = authActionClient
  .inputSchema(
    z.object({ currentSlug: z.string(), name: workspaceNameSchema, slug: workspaceSlugSchema }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.currentSlug);
    const updated = await updateWorkspace({
      workspaceId: workspace.id,
      userId: ctx.user.id,
      name: parsedInput.name,
      slug: parsedInput.slug,
    });
    if (updated.slug !== parsedInput.currentSlug) redirect(`/${updated.slug}/settings` as Route);
    refresh();
    return { name: updated.name, slug: updated.slug };
  });

export const deleteWorkspaceAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), confirmName: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    await deleteWorkspace({
      workspaceId: workspace.id,
      userId: ctx.user.id,
      confirmName: parsedInput.confirmName,
    });
    redirect("/");
  });
