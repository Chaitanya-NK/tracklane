"use server";

import type { Route } from "next";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getWorkspaceAccess } from "@/server/authz";
import { authActionClient } from "@/server/safe-action";
import { createDoc, deleteDoc, getDocVersion, saveDoc } from "./service";

const title = z.string().trim().min(1, "Give the page a title").max(200);

export const createDocAction = authActionClient
  .inputSchema(
    z.object({
      slug: z.string(),
      title,
      projectId: z.string().nullable(),
      parentId: z.string().nullable(),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    const doc = await createDoc({ ...parsedInput, workspaceId: workspace.id, userId: ctx.user.id });
    return doc;
  });

export const saveDocAction = authActionClient
  .inputSchema(
    z.object({
      slug: z.string(),
      docId: z.string(),
      title,
      body: z.string().max(200_000, "Pages are limited to 200,000 characters"),
      baseVersion: z.number().int(),
      force: z.boolean().optional(),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    const result = await saveDoc({
      ...parsedInput,
      workspaceId: workspace.id,
      userId: ctx.user.id,
    });
    refresh();
    return result;
  });

export const getDocVersionAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), docId: z.string(), version: z.number().int() }))
  .action(async ({ parsedInput }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    return getDocVersion(workspace.id, parsedInput.docId, parsedInput.version);
  });

export const deleteDocAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), docId: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    const doc = await deleteDoc(workspace.id, ctx.user.id, parsedInput.docId);
    redirect(
      (doc.parentId
        ? `/${parsedInput.slug}/docs/${doc.parentId}`
        : `/${parsedInput.slug}/docs`) as Route,
    );
  });
