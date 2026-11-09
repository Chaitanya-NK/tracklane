"use server";

import { dueDateSchema } from "@tracklane/core";
import { refresh } from "next/cache";
import { z } from "zod";
import { getProjectAccess } from "@/server/authz";
import { authActionClient } from "@/server/safe-action";
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
