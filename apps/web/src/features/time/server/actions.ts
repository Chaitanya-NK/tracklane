"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { authActionClient } from "@/server/safe-action";
import { deleteWorklog, logWork, updateWorklog } from "./service";

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
