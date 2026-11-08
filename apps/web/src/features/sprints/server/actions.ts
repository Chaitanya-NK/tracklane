"use server";

import { dueDateSchema, sprintGoalSchema, sprintNameSchema } from "@tracklane/core";
import { refresh } from "next/cache";
import { z } from "zod";
import { getProjectAccess } from "@/server/authz";
import { authActionClient } from "@/server/safe-action";
import { completeSprint, createSprint, deleteSprint, startSprint, updateSprint } from "./service";

const date = dueDateSchema.unwrap();

export const createSprintAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), projectKey: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace, project } = await getProjectAccess(parsedInput.slug, parsedInput.projectKey);
    const sprint = await createSprint({
      workspaceId: workspace.id,
      projectId: project.id,
      userId: ctx.user.id,
    });
    refresh();
    return sprint;
  });

export const updateSprintAction = authActionClient
  .inputSchema(
    z.object({
      sprintId: z.string(),
      name: sprintNameSchema,
      goal: sprintGoalSchema,
      startDate: date.nullable(),
      endDate: date.nullable(),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    await updateSprint({ ...parsedInput, userId: ctx.user.id });
    refresh();
  });

export const startSprintAction = authActionClient
  .inputSchema(
    z.object({
      sprintId: z.string(),
      name: sprintNameSchema,
      goal: sprintGoalSchema,
      startDate: date,
      endDate: date,
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    await startSprint({ ...parsedInput, userId: ctx.user.id });
    refresh();
  });

export const completeSprintAction = authActionClient
  .inputSchema(z.object({ sprintId: z.string(), moveOpenTo: z.string().nullable() }))
  .action(async ({ parsedInput, ctx }) => {
    const result = await completeSprint({ ...parsedInput, userId: ctx.user.id });
    refresh();
    return result;
  });

export const deleteSprintAction = authActionClient
  .inputSchema(z.object({ sprintId: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const result = await deleteSprint({ ...parsedInput, userId: ctx.user.id });
    refresh();
    return result;
  });
