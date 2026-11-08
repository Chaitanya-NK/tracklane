"use server";

import { prioritySchema, TQL_VALUE_KINDS } from "@tracklane/core";
import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { getWorkspaceAccess } from "@/server/authz";
import { authActionClient } from "@/server/safe-action";
import { storage } from "@/server/storage";
import { bulkDelete, bulkUpdate, MAX_BULK } from "./bulk";
import { createFilter, deleteFilter, toggleFavorite, updateFilter } from "./filters";
import { createTqlFunction, deleteTqlFunction, updateTqlFunction } from "./functions";
import { getTqlCatalog } from "./search";

const filterFields = {
  name: z.string().trim().min(1, "Name the filter").max(80),
  description: z.string().trim().max(500),
  query: z.string().max(5000),
  shared: z.boolean(),
};

export const createFilterAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), ...filterFields }))
  .action(async ({ parsedInput: { slug, ...fields }, ctx }) => {
    const { workspace } = await getWorkspaceAccess(slug);
    const filter = await createFilter({
      ...fields,
      workspaceId: workspace.id,
      userId: ctx.user.id,
    });
    refresh();
    return filter;
  });

export const updateFilterAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), filterId: z.string(), ...filterFields }))
  .action(async ({ parsedInput: { slug, ...fields }, ctx }) => {
    const { role } = await getWorkspaceAccess(slug);
    const filter = await updateFilter({ ...fields, userId: ctx.user.id, role });
    refresh();
    return filter;
  });

export const deleteFilterAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), filterId: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const { role } = await getWorkspaceAccess(parsedInput.slug);
    await deleteFilter({ filterId: parsedInput.filterId, userId: ctx.user.id, role });
    refresh();
  });

export const toggleFavoriteAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), filterId: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    const result = await toggleFavorite({
      filterId: parsedInput.filterId,
      userId: ctx.user.id,
      workspaceId: workspace.id,
    });
    refresh();
    return result;
  });

export const getTqlCatalogAction = authActionClient
  .inputSchema(z.object({ slug: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    return getTqlCatalog(workspace.id, ctx.user.id);
  });

const ids = z.array(z.string()).min(1).max(MAX_BULK);

export const bulkUpdateAction = authActionClient
  .inputSchema(
    z.object({
      slug: z.string(),
      issueIds: ids,
      patch: z.object({
        assigneeId: z.string().nullable().optional(),
        priority: prioritySchema.optional(),
        statusName: z.string().min(1).optional(),
        sprintId: z.string().nullable().optional(),
        addLabelName: z.string().trim().min(1).max(40).optional(),
      }),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    const result = await bulkUpdate({
      workspaceId: workspace.id,
      userId: ctx.user.id,
      issueIds: parsedInput.issueIds,
      patch: parsedInput.patch,
    });
    refresh();
    return result;
  });

export const bulkDeleteAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), issueIds: ids }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    const { deleted, storageKeys } = await bulkDelete({
      workspaceId: workspace.id,
      userId: ctx.user.id,
      issueIds: parsedInput.issueIds,
    });
    after(() => Promise.all(storageKeys.map((key) => storage().delete(key))));
    refresh();
    return { deleted };
  });

const tqlFunctionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("condition"),
    name: z.string().trim().max(40),
    description: z.string().trim().max(300),
    body: z.string().max(5000),
  }),
  z.object({
    kind: z.literal("values"),
    name: z.string().trim().max(40),
    description: z.string().trim().max(300),
    valueKind: z.enum(TQL_VALUE_KINDS),
    values: z.array(z.string().max(200)).max(200),
  }),
]);

export const createTqlFunctionAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), fn: tqlFunctionSchema }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    const fn = await createTqlFunction(workspace.id, ctx.user.id, parsedInput.fn);
    refresh();
    return fn;
  });

export const updateTqlFunctionAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), functionId: z.string(), fn: tqlFunctionSchema }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    const fn = await updateTqlFunction(
      workspace.id,
      ctx.user.id,
      parsedInput.functionId,
      parsedInput.fn,
    );
    refresh();
    return fn;
  });

export const deleteTqlFunctionAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), functionId: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    await deleteTqlFunction(workspace.id, ctx.user.id, parsedInput.functionId);
    refresh();
  });
