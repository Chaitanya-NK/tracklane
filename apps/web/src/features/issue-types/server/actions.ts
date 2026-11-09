"use server";

import { ISSUE_TYPES, LABEL_COLORS } from "@tracklane/core";
import { refresh } from "next/cache";
import { z } from "zod";
import { getProjectAccess } from "@/server/authz";
import { authActionClient } from "@/server/safe-action";
import { deleteIssueType, saveIssueType } from "./service";

const scope = { slug: z.string(), projectKey: z.string() };

export const saveIssueTypeAction = authActionClient
  .inputSchema(
    z.object({
      ...scope,
      id: z.string().nullable(),
      issueType: z.object({
        name: z.string().trim().min(1, "Name the type").max(40),
        baseType: z.enum(ISSUE_TYPES),
        color: z.enum(LABEL_COLORS),
        icon: z.string().max(20),
      }),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { workspace, project } = await getProjectAccess(parsedInput.slug, parsedInput.projectKey);
    const row = await saveIssueType(
      workspace.id,
      project.id,
      ctx.user.id,
      parsedInput.id,
      parsedInput.issueType,
    );
    refresh();
    return row;
  });

export const deleteIssueTypeAction = authActionClient
  .inputSchema(z.object({ ...scope, id: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace, project } = await getProjectAccess(parsedInput.slug, parsedInput.projectKey);
    await deleteIssueType(workspace.id, project.id, ctx.user.id, parsedInput.id);
    refresh();
  });
