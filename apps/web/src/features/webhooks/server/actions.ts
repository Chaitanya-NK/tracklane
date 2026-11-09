"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getWorkspaceAccess } from "@/server/authz";
import { authActionClient } from "@/server/safe-action";
import {
  createWebhook,
  deleteWebhook,
  pingWebhook,
  redeliver,
  rotateWebhookSecret,
  updateWebhook,
} from "./service";

const slug = z.string();
const url = z.string().trim().min(1, "Enter a URL").max(2000);
const events = z.array(z.string()).max(20);

export const createWebhookAction = authActionClient
  .inputSchema(z.object({ slug, url, events }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    const result = await createWebhook(workspace.id, ctx.user.id, parsedInput);
    refresh();
    return result;
  });

export const updateWebhookAction = authActionClient
  .inputSchema(z.object({ slug, id: z.string(), url, events, active: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    await updateWebhook(workspace.id, ctx.user.id, parsedInput.id, parsedInput);
    refresh();
  });

export const rotateWebhookSecretAction = authActionClient
  .inputSchema(z.object({ slug, id: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    return rotateWebhookSecret(workspace.id, ctx.user.id, parsedInput.id);
  });

export const deleteWebhookAction = authActionClient
  .inputSchema(z.object({ slug, id: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    await deleteWebhook(workspace.id, ctx.user.id, parsedInput.id);
    refresh();
  });

export const pingWebhookAction = authActionClient
  .inputSchema(z.object({ slug, id: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    await pingWebhook(workspace.id, ctx.user.id, parsedInput.id);
    refresh();
  });

export const redeliverAction = authActionClient
  .inputSchema(z.object({ slug, deliveryId: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    await redeliver(workspace.id, ctx.user.id, parsedInput.deliveryId);
    refresh();
  });
