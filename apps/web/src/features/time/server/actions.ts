"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { authActionClient } from "@/server/safe-action";
import { getWorkspaceAccess } from "@/server/authz";
import { deleteWorklog, logWork, updateWorklog } from "./service";
import { addTimeOff, removeTimeOff } from "./time-off";
import {
  copyLastWeek,
  decideTimesheet,
  findIssueByKey,
  setDayTime,
  setWeekBillable,
  startTimer,
  stopTimer,
  submitWeek,
} from "./sheet";

const entry = {
  minutes: z.number().int(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().max(500).default(""),
};

export const logWorkAction = authActionClient
  .inputSchema(z.object({ issueId: z.string(), ...entry }))
  .action(async ({ parsedInput, ctx }) => {
    const result = await logWork({ ...parsedInput, userId: ctx.user.id });
    refresh();
    return result;
  });

export const updateWorklogAction = authActionClient
  .inputSchema(z.object({ worklogId: z.string(), ...entry }))
  .action(async ({ parsedInput, ctx }) => {
    await updateWorklog({ ...parsedInput, userId: ctx.user.id });
    refresh();
  });

export const deleteWorklogAction = authActionClient
  .inputSchema(z.object({ worklogId: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    await deleteWorklog({ ...parsedInput, userId: ctx.user.id });
    refresh();
  });

const week = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const setDayTimeAction = authActionClient
  .inputSchema(
    z.object({
      issueId: z.string(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      minutes: z.number().int().min(0).max(1440),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    await setDayTime({ ...parsedInput, userId: ctx.user.id });
    refresh();
  });

export const setWeekBillableAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), issueId: z.string(), week, billable: z.boolean() }))
  .action(async ({ parsedInput: { slug, ...input }, ctx }) => {
    const { workspace } = await getWorkspaceAccess(slug);
    await setWeekBillable({ ...input, userId: ctx.user.id, workspaceId: workspace.id });
    refresh();
  });

export const copyLastWeekAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), week }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    const result = await copyLastWeek({
      userId: ctx.user.id,
      workspaceId: workspace.id,
      week: parsedInput.week,
    });
    refresh();
    return result;
  });

export const submitWeekAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), week }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    await submitWeek({ userId: ctx.user.id, workspaceId: workspace.id, week: parsedInput.week });
    refresh();
  });

export const decideTimesheetAction = authActionClient
  .inputSchema(
    z.object({
      slug: z.string(),
      submissionId: z.string(),
      decision: z.enum(["approved", "rejected"]),
      note: z.string().trim().max(500).default(""),
    }),
  )
  .action(async ({ parsedInput: { slug, ...input }, ctx }) => {
    const { workspace } = await getWorkspaceAccess(slug);
    await decideTimesheet({ ...input, userId: ctx.user.id, workspaceId: workspace.id });
    refresh();
  });

export const startTimerAction = authActionClient
  .inputSchema(
    z.object({
      slug: z.string(),
      issueId: z.string().optional(),
      issueKey: z.string().max(40).optional(),
    }),
  )
  .action(async ({ parsedInput: { slug, ...input }, ctx }) => {
    const { workspace } = await getWorkspaceAccess(slug);
    await startTimer({ ...input, userId: ctx.user.id, workspaceId: workspace.id });
    refresh();
  });

export const stopTimerAction = authActionClient
  .inputSchema(z.object({ log: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => {
    const result = await stopTimer({ userId: ctx.user.id, log: parsedInput.log });
    refresh();
    return result;
  });

export const findIssueAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), issueKey: z.string().max(40) }))
  .action(async ({ parsedInput }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    return findIssueByKey(workspace.id, parsedInput.issueKey);
  });

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const addTimeOffAction = authActionClient
  .inputSchema(
    z.object({
      slug: z.string(),
      userId: z.string(),
      startDate: ymd,
      endDate: ymd,
      note: z.string().trim().max(200).default(""),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const result = await addTimeOff({ ...parsedInput, actorId: ctx.user.id });
    refresh();
    return result;
  });

export const removeTimeOffAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), id: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    await removeTimeOff({ ...parsedInput, actorId: ctx.user.id });
    refresh();
  });
