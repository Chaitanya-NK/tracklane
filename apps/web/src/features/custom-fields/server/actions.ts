"use server";

import { CUSTOM_FIELD_TYPES, LABEL_COLORS } from "@tracklane/core";
import { refresh } from "next/cache";
import { z } from "zod";
import { getProjectAccess } from "@/server/authz";
import { authActionClient } from "@/server/safe-action";
import { setIssueFieldValue } from "./issue-values";
import { createField, deleteField, reorderFields, updateField } from "./service";
import { fieldValueSchema } from "./values";

const project = { slug: z.string(), projectKey: z.string() };
const fieldFields = {
  name: z.string().trim().min(1, "Name the field").max(60),
  description: z.string().trim().max(300),
  required: z.boolean(),
  options: z
    .array(
      z.object({
        id: z.string().optional(),
        value: z.string().max(60),
        color: z.enum(LABEL_COLORS),
      }),
    )
    .max(100),
};

async function access(slug: string, projectKey: string, userId: string) {
  const { workspace, project } = await getProjectAccess(slug, projectKey);
  return { workspaceId: workspace.id, projectId: project.id, userId };
}

export const createFieldAction = authActionClient
  .inputSchema(z.object({ ...project, ...fieldFields, type: z.enum(CUSTOM_FIELD_TYPES) }))
  .action(async ({ parsedInput: { slug, projectKey, ...fields }, ctx }) => {
    const field = await createField({
      ...(await access(slug, projectKey, ctx.user.id)),
      ...fields,
    });
    refresh();
    return field;
  });

export const updateFieldAction = authActionClient
  .inputSchema(z.object({ ...project, fieldId: z.string(), ...fieldFields }))
  .action(async ({ parsedInput: { slug, projectKey, ...fields }, ctx }) => {
    const field = await updateField({
      ...(await access(slug, projectKey, ctx.user.id)),
      ...fields,
    });
    refresh();
    return field;
  });

export const deleteFieldAction = authActionClient
  .inputSchema(z.object({ ...project, fieldId: z.string() }))
  .action(async ({ parsedInput: { slug, projectKey, fieldId }, ctx }) => {
    await deleteField({ ...(await access(slug, projectKey, ctx.user.id)), fieldId });
    refresh();
  });

export const reorderFieldsAction = authActionClient
  .inputSchema(z.object({ ...project, fieldIds: z.array(z.string()).max(100) }))
  .action(async ({ parsedInput: { slug, projectKey, fieldIds }, ctx }) => {
    await reorderFields({ ...(await access(slug, projectKey, ctx.user.id)), fieldIds });
    refresh();
  });

export const setIssueFieldValueAction = authActionClient
  .inputSchema(z.object({ issueId: z.string(), fieldId: z.string(), value: fieldValueSchema }))
  .action(async ({ parsedInput, ctx }) => {
    const result = await setIssueFieldValue({ ...parsedInput, userId: ctx.user.id });
    refresh();
    return result;
  });
