"use server";

import { ISSUE_TYPES, PRIORITIES, RECURRENCE_FREQUENCIES } from "@tracklane/core";
import { refresh } from "next/cache";
import { z } from "zod";
import { getProjectAccess } from "@/server/authz";
import { authActionClient } from "@/server/safe-action";
import { deleteRecurring, saveRecurring, setRecurringEnabled } from "./service";

const scope = { slug: z.string(), projectKey: z.string() };

export const saveRecurringAction = authActionClient
  .inputSchema(
    z.object({
      ...scope,
      id: z.string().nullable(),
      recurring: z.object({
        title: z.string().trim().min(1, "Give it a title").max(255),
        description: z.string().max(20_000),
        type: z.enum(ISSUE_TYPES).exclude(["epic", "subtask"]),
        priority: z.enum(PRIORITIES),
        assigneeId: z.string().nullable(),
        frequency: z.enum(RECURRENCE_FREQUENCIES),
        days: z.array(z.number().int().min(1).max(31)).max(7),
        dueInDays: z.number().int().min(0).max(365).nullable(),
      }),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { workspace, project } = await getProjectAccess(parsedInput.slug, parsedInput.projectKey);
    const row = await saveRecurring(
      workspace.id,
      project.id,
      ctx.user.id,
      parsedInput.id,
      parsedInput.recurring,
    );
    refresh();
    return row;
  });

export const setRecurringEnabledAction = authActionClient
  .inputSchema(z.object({ ...scope, id: z.string(), enabled: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace, project } = await getProjectAccess(parsedInput.slug, parsedInput.projectKey);
    await setRecurringEnabled(
      workspace.id,
      project.id,
      ctx.user.id,
      parsedInput.id,
      parsedInput.enabled,
    );
    refresh();
  });

export const deleteRecurringAction = authActionClient
  .inputSchema(z.object({ ...scope, id: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace, project } = await getProjectAccess(parsedInput.slug, parsedInput.projectKey);
    await deleteRecurring(workspace.id, project.id, ctx.user.id, parsedInput.id);
    refresh();
  });
