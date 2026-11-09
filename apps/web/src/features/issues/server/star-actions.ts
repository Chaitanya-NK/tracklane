"use server";

import { AppError } from "@tracklane/core";
import { db } from "@tracklane/db";
import { refresh } from "next/cache";
import { z } from "zod";
import { getWorkspaceAccess } from "@/server/authz";
import { authActionClient } from "@/server/safe-action";

export const toggleIssueStarAction = authActionClient
  .inputSchema(z.object({ issueId: z.string(), starred: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => {
    const issue = await db.issue.findUnique({
      where: { id: parsedInput.issueId },
      select: { workspace: { select: { slug: true } } },
    });
    if (!issue) throw new AppError("not_found", "Issue not found");
    await getWorkspaceAccess(issue.workspace.slug);
    const key = { userId: ctx.user.id, issueId: parsedInput.issueId };
    if (parsedInput.starred) {
      await db.issueStar.upsert({ where: { userId_issueId: key }, create: key, update: {} });
    } else {
      await db.issueStar.deleteMany({ where: key });
    }
    refresh();
  });

export const toggleProjectStarAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), projectId: z.string(), starred: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    const project = await db.project.findFirst({
      where: { id: parsedInput.projectId, workspaceId: workspace.id },
      select: { id: true },
    });
    if (!project) throw new AppError("not_found", "Project not found");
    const key = { userId: ctx.user.id, projectId: project.id };
    if (parsedInput.starred) {
      await db.projectStar.upsert({ where: { userId_projectId: key }, create: key, update: {} });
    } else {
      await db.projectStar.deleteMany({ where: key });
    }
    refresh();
  });
