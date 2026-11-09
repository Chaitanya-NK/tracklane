"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { assertProjectPermission } from "./permissions";
import { deleteComponent, saveComponent } from "./service";
import { authActionClient } from "@/server/safe-action";

const target = { slug: z.string(), projectKey: z.string() };

export const saveComponentAction = authActionClient
  .inputSchema(
    z.object({
      ...target,
      componentId: z.string().nullable(),
      component: z.object({
        name: z.string().trim().min(1, "Name the component").max(60),
        description: z.string().trim().max(500),
        leadId: z.string().nullable(),
      }),
    }),
  )
  .action(async ({ parsedInput }) => {
    const { workspace, project } = await assertProjectPermission(parsedInput);
    const saved = await saveComponent({
      workspaceId: workspace.id,
      projectId: project.id,
      componentId: parsedInput.componentId,
      component: parsedInput.component,
    });
    refresh();
    return saved;
  });

export const deleteComponentAction = authActionClient
  .inputSchema(z.object({ ...target, componentId: z.string() }))
  .action(async ({ parsedInput }) => {
    const { project } = await assertProjectPermission(parsedInput);
    await deleteComponent(project.id, parsedInput.componentId);
    refresh();
  });
