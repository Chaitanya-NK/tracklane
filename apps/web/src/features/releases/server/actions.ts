"use server";

import { AppError, can, dueDateSchema } from "@tracklane/core";
import { refresh } from "next/cache";
import { z } from "zod";
import { getProjectAccess } from "@/server/authz";
import { authActionClient } from "@/server/safe-action";
import { addChecklistItems, setChecklistItem } from "./checklist";
import { deleteRelease, saveRelease, setReleaseStatus, shipRelease } from "./service";

const scope = { slug: z.string(), projectKey: z.string() };

export const saveReleaseAction = authActionClient
  .inputSchema(
    z.object({
      ...scope,
      releaseId: z.string().nullable(),
      release: z.object({
        name: z.string().trim().min(1, "Name the release").max(60),
        description: z.string().max(5000),
        startDate: dueDateSchema,
        releaseDate: dueDateSchema,
      }),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { workspace, project } = await getProjectAccess(parsedInput.slug, parsedInput.projectKey);
    const row = await saveRelease(
      workspace.id,
      project.id,
      ctx.user.id,
      parsedInput.releaseId,
      parsedInput.release,
    );
    refresh();
    return row;
  });

export const shipReleaseAction = authActionClient
  .inputSchema(z.object({ ...scope, releaseId: z.string(), moveOpenTo: z.string().nullable() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace, project } = await getProjectAccess(parsedInput.slug, parsedInput.projectKey);
    const result = await shipRelease(
      workspace.id,
      project.id,
      ctx.user.id,
      parsedInput.releaseId,
      parsedInput.moveOpenTo,
    );
    refresh();
    return result;
  });

export const setReleaseStatusAction = authActionClient
  .inputSchema(
    z.object({
      ...scope,
      releaseId: z.string(),
      status: z.enum(["unreleased", "released", "archived"]),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { workspace, project } = await getProjectAccess(parsedInput.slug, parsedInput.projectKey);
    await setReleaseStatus(
      workspace.id,
      project.id,
      ctx.user.id,
      parsedInput.releaseId,
      parsedInput.status,
    );
    refresh();
  });

export const deleteReleaseAction = authActionClient
  .inputSchema(z.object({ ...scope, releaseId: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace, project } = await getProjectAccess(parsedInput.slug, parsedInput.projectKey);
    await deleteRelease(workspace.id, project.id, ctx.user.id, parsedInput.releaseId);
    refresh();
  });

export const addChecklistItemsAction = authActionClient
  .inputSchema(
    z.object({
      ...scope,
      releaseId: z.string(),
      texts: z.array(z.string().trim().min(1).max(200)).min(1).max(10),
    }),
  )
  .action(async ({ parsedInput }) => {
    const { project } = await editable(parsedInput.slug, parsedInput.projectKey);
    await addChecklistItems(project.id, parsedInput.releaseId, parsedInput.texts);
    refresh();
  });

export const setChecklistItemAction = authActionClient
  .inputSchema(
    z.object({
      ...scope,
      itemId: z.string(),
      done: z.boolean().optional(),
      remove: z.boolean().optional(),
    }),
  )
  .action(async ({ parsedInput }) => {
    const { project } = await editable(parsedInput.slug, parsedInput.projectKey);
    await setChecklistItem(project.id, parsedInput.itemId, parsedInput);
    refresh();
  });

/** Checklists follow release editing rights (project admins). */
async function editable(slug: string, projectKey: string) {
  const access = await getProjectAccess(slug, projectKey);
  if (!can(access.role, "projects:update")) {
    throw new AppError("forbidden", "Only project admins can change release checklists");
  }
  return access;
}
