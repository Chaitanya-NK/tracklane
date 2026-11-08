"use server";

import {
  commentBodySchema,
  dueDateSchema,
  estimateSchema,
  issueTitleSchema,
  issueTypeSchema,
  markdownSchema,
  prioritySchema,
} from "@tracklane/core";
import type { Route } from "next";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { listProjects } from "@/features/projects/server";
import { getProjectAccess, getWorkspaceAccess } from "@/server/authz";
import { authActionClient } from "@/server/safe-action";
import { storage } from "@/server/storage";
import {
  addComment,
  createIssue,
  deleteAttachment,
  deleteComment,
  deleteIssue,
  moveIssue,
  updateComment,
  updateIssue,
} from "./service";
import { loadIssueFormOptions } from "./form-options";

const issueFields = {
  title: issueTitleSchema,
  type: issueTypeSchema,
  priority: prioritySchema,
  description: markdownSchema,
  statusId: z.string(),
  assigneeId: z.string().nullable(),
  parentId: z.string().nullable(),
  dueDate: dueDateSchema,
  estimate: estimateSchema,
  labelIds: z.array(z.string()).max(20),
  sprintId: z.string().nullable(),
};

export const createIssueAction = authActionClient
  .inputSchema(
    z.object({
      slug: z.string(),
      projectKey: z.string(),
      ...issueFields,
      statusId: issueFields.statusId.optional(),
      description: issueFields.description.optional(),
      assigneeId: issueFields.assigneeId.optional(),
      parentId: issueFields.parentId.optional(),
      dueDate: issueFields.dueDate.optional(),
      estimate: issueFields.estimate.optional(),
      labelIds: issueFields.labelIds.optional(),
      sprintId: issueFields.sprintId.optional(),
    }),
  )
  .action(async ({ parsedInput: { slug, projectKey, ...fields }, ctx }) => {
    const { workspace, project } = await getProjectAccess(slug, projectKey);
    const issue = await createIssue({
      ...fields,
      workspaceId: workspace.id,
      projectId: project.id,
      userId: ctx.user.id,
    });
    refresh();
    return issue;
  });

export const updateIssueAction = authActionClient
  .inputSchema(z.object({ issueId: z.string(), patch: z.object(issueFields).partial() }))
  .action(async ({ parsedInput, ctx }) => {
    const result = await updateIssue({ ...parsedInput, userId: ctx.user.id });
    refresh();
    return result;
  });

export const deleteIssueAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), issueId: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const { projectKey, storageKeys } = await deleteIssue({
      issueId: parsedInput.issueId,
      userId: ctx.user.id,
    });
    after(() => Promise.all(storageKeys.map((key) => storage().delete(key))));
    redirect(`/${parsedInput.slug}/projects/${projectKey}` as Route);
  });

export const addCommentAction = authActionClient
  .inputSchema(z.object({ issueId: z.string(), body: commentBodySchema }))
  .action(async ({ parsedInput, ctx }) => {
    await addComment({ ...parsedInput, userId: ctx.user.id });
    refresh();
  });

export const updateCommentAction = authActionClient
  .inputSchema(z.object({ commentId: z.string(), body: commentBodySchema }))
  .action(async ({ parsedInput, ctx }) => {
    await updateComment({ ...parsedInput, userId: ctx.user.id });
    refresh();
  });

export const deleteCommentAction = authActionClient
  .inputSchema(z.object({ commentId: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    await deleteComment({ ...parsedInput, userId: ctx.user.id });
    refresh();
  });

export const deleteAttachmentAction = authActionClient
  .inputSchema(z.object({ attachmentId: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const storageKey = await deleteAttachment({ ...parsedInput, userId: ctx.user.id });
    after(() => storage().delete(storageKey));
    refresh();
  });

/** Data for the create-issue dialog, loaded when the user picks a project. */
export const getIssueFormOptionsAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), projectKey: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace, project, role } = await getProjectAccess(
      parsedInput.slug,
      parsedInput.projectKey,
    );
    return loadIssueFormOptions({ workspaceId: workspace.id, project, role, userId: ctx.user.id });
  });

/** Projects for the create-issue dialog's project picker. */
export const listProjectOptionsAction = authActionClient
  .inputSchema(z.object({ slug: z.string() }))
  .action(async ({ parsedInput }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    const projects = await listProjects(workspace.id);
    return projects.map((p) => ({ key: p.key, name: p.name }));
  });

/** Drag and drop on the board and backlog. */
export const moveIssueAction = authActionClient
  .inputSchema(
    z.object({
      issueId: z.string(),
      statusId: z.string().optional(),
      sprintId: z.string().nullable().optional(),
      beforeId: z.string().nullable().optional(),
      afterId: z.string().nullable().optional(),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const result = await moveIssue({ ...parsedInput, userId: ctx.user.id });
    refresh();
    return result;
  });
