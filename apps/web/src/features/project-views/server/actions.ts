"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getProjectAccess } from "@/server/authz";
import { authActionClient } from "@/server/safe-action";
import { createView, deleteView, saveView, updateViewSharing } from "./service";

const target = { slug: z.string(), projectKey: z.string() };
const view = z.object({
  name: z.string().trim().min(1, "Name the view").max(60),
  params: z.string().max(2000),
  groupBy: z.string().max(80),
  columns: z.array(z.string().max(40)).max(20),
});
const sharing = z.object({ shared: z.boolean(), editable: z.boolean(), isDefault: z.boolean() });

export const createViewAction = authActionClient
  .inputSchema(z.object({ ...target, view, sharing }))
  .action(async ({ parsedInput, ctx }) => {
    const { project, role } = await getProjectAccess(parsedInput.slug, parsedInput.projectKey);
    const created = await createView({
      projectId: project.id,
      userId: ctx.user.id,
      role,
      view: parsedInput.view,
      sharing: parsedInput.sharing,
    });
    refresh();
    return created;
  });

export const saveViewAction = authActionClient
  .inputSchema(z.object({ ...target, viewId: z.string(), view }))
  .action(async ({ parsedInput, ctx }) => {
    const { project } = await getProjectAccess(parsedInput.slug, parsedInput.projectKey);
    await saveView({
      projectId: project.id,
      userId: ctx.user.id,
      viewId: parsedInput.viewId,
      view: parsedInput.view,
    });
    refresh();
  });

export const updateViewSharingAction = authActionClient
  .inputSchema(
    z.object({
      ...target,
      viewId: z.string(),
      name: z.string().trim().min(1, "Name the view").max(60),
      sharing,
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { project, role } = await getProjectAccess(parsedInput.slug, parsedInput.projectKey);
    await updateViewSharing({
      projectId: project.id,
      userId: ctx.user.id,
      role,
      viewId: parsedInput.viewId,
      name: parsedInput.name,
      sharing: parsedInput.sharing,
    });
    refresh();
  });

export const deleteViewAction = authActionClient
  .inputSchema(z.object({ ...target, viewId: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const { project, role } = await getProjectAccess(parsedInput.slug, parsedInput.projectKey);
    await deleteView({
      projectId: project.id,
      userId: ctx.user.id,
      role,
      viewId: parsedInput.viewId,
    });
    refresh();
  });
