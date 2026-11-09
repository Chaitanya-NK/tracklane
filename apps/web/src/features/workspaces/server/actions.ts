"use server";

import { workspaceNameSchema, workspaceSlugSchema } from "@tracklane/core";
import type { Route } from "next";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getWorkspaceAccess } from "@/server/authz";
import { authActionClient } from "@/server/safe-action";
import { getDefaultWorkspaceSlug } from "./queries";
import { createWorkspace, deleteWorkspace, setWorkspaceProfile, updateWorkspace } from "./service";

export const createWorkspaceAction = authActionClient
  .inputSchema(z.object({ name: workspaceNameSchema, slug: workspaceSlugSchema }))
  .action(async ({ parsedInput, ctx }) => {
    const workspace = await createWorkspace({ ...parsedInput, userId: ctx.user.id });
    redirect(`/onboarding/${workspace.slug}` as Route);
  });

export const setWorkspaceProfileAction = authActionClient
  .inputSchema(
    z.object({
      slug: z.string(),
      teamSize: z.string().max(20),
      useCases: z.array(z.string().max(20)).max(10),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    await setWorkspaceProfile({
      workspaceId: workspace.id,
      userId: ctx.user.id,
      teamSize: parsedInput.teamSize,
      useCases: parsedInput.useCases,
    });
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

/**
 * Where to go after signing in when no callback URL was given: the last workspace, or
 * onboarding. Asking here avoids a client navigation to "/" that only redirects.
 */
export const homePathAction = authActionClient.action(async ({ ctx }) => {
  const slug = await getDefaultWorkspaceSlug(ctx.user.id);
  return slug ? `/${slug}` : "/onboarding";
});
