"use server";

import { dueDateSchema } from "@tracklane/core";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { z } from "zod";
import { getWorkspaceAccess } from "@/server/authz";
import { authActionClient } from "@/server/safe-action";
import {
  deleteGoal,
  GOAL_STATUSES,
  linkGoalIssues,
  saveGoal,
  setGoalStatus,
  unlinkGoalIssue,
} from "./service";

export const saveGoalAction = authActionClient
  .inputSchema(
    z.object({
      slug: z.string(),
      goalId: z.string().nullable(),
      goal: z.object({
        name: z.string().trim().min(1, "Name the goal").max(120),
        description: z.string().max(10_000),
        status: z.enum(GOAL_STATUSES),
        ownerId: z.string().nullable(),
        targetDate: dueDateSchema,
      }),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    const goal = await saveGoal(workspace.id, ctx.user.id, parsedInput.goalId, parsedInput.goal);
    refresh();
    return goal;
  });

export const setGoalStatusAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), goalId: z.string(), status: z.enum(GOAL_STATUSES) }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    await setGoalStatus(workspace.id, ctx.user.id, parsedInput.goalId, parsedInput.status);
    refresh();
  });

export const deleteGoalAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), goalId: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    await deleteGoal(workspace.id, ctx.user.id, parsedInput.goalId);
    redirect(`/${parsedInput.slug}/goals` as Route);
  });

export const linkGoalIssuesAction = authActionClient
  .inputSchema(
    z.object({
      slug: z.string(),
      goalId: z.string(),
      keys: z.string().trim().min(1, "Enter issue keys").max(2000),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    const added = await linkGoalIssues(
      workspace.id,
      ctx.user.id,
      parsedInput.goalId,
      parsedInput.keys
        .split(/[\s,]+/)
        .filter(Boolean)
        .slice(0, 50),
    );
    refresh();
    return { added };
  });

export const unlinkGoalIssueAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), goalId: z.string(), issueId: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    await unlinkGoalIssue(workspace.id, ctx.user.id, parsedInput.goalId, parsedInput.issueId);
    refresh();
  });
