"use server";

import {
  labelColorSchema,
  labelNameSchema,
  markdownSchema,
  projectKeySchema,
  projectNameSchema,
  projectTypeSchema,
} from "@tracklane/core";
import type { Route } from "next";
import { after } from "next/server";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getProjectAccess, getWorkspaceAccess } from "@/server/authz";
import { authActionClient } from "@/server/safe-action";
import { storage } from "@/server/storage";
import { createLabel, createProject, deleteProject, updateProject } from "./service";

export const createProjectAction = authActionClient
  .inputSchema(
    z.object({
      slug: z.string(),
      name: projectNameSchema,
      key: projectKeySchema,
      type: projectTypeSchema,
      description: markdownSchema.optional(),
    }),
  )
  .action(async ({ parsedInput: { slug, ...input }, ctx }) => {
    const { workspace } = await getWorkspaceAccess(slug);
    const project = await createProject({
      ...input,
      workspaceId: workspace.id,
      userId: ctx.user.id,
    });
    redirect(`/${slug}/projects/${project.key}` as Route);
  });

export const updateProjectAction = authActionClient
  .inputSchema(
    z.object({
      slug: z.string(),
      projectKey: z.string(),
      name: projectNameSchema,
      description: markdownSchema,
      leadId: z.string().nullable(),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { workspace, project } = await getProjectAccess(parsedInput.slug, parsedInput.projectKey);
    await updateProject({
      workspaceId: workspace.id,
      projectId: project.id,
      userId: ctx.user.id,
      name: parsedInput.name,
      description: parsedInput.description,
      leadId: parsedInput.leadId,
    });
    refresh();
  });

export const deleteProjectAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), projectKey: z.string(), confirmKey: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace, project } = await getProjectAccess(parsedInput.slug, parsedInput.projectKey);
    const storageKeys = await deleteProject({
      workspaceId: workspace.id,
      projectId: project.id,
      userId: ctx.user.id,
      confirmKey: parsedInput.confirmKey,
    });
    // Rows are gone; remove the files after the response.
    after(() => Promise.all(storageKeys.map((key) => storage().delete(key))));
    redirect(`/${parsedInput.slug}/projects` as Route);
  });

export const createLabelAction = authActionClient
  .inputSchema(
    z.object({
      slug: z.string(),
      projectKey: z.string(),
      name: labelNameSchema,
      color: labelColorSchema,
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { workspace, project } = await getProjectAccess(parsedInput.slug, parsedInput.projectKey);
    return createLabel({
      workspaceId: workspace.id,
      projectId: project.id,
      userId: ctx.user.id,
      name: parsedInput.name,
      color: parsedInput.color,
    });
  });
