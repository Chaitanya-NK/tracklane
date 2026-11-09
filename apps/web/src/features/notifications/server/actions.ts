"use server";

import { NOTIFICATION_TYPES } from "@tracklane/core";
import { refresh } from "next/cache";
import { z } from "zod";
import { getWorkspaceAccess } from "@/server/authz";
import { authActionClient } from "@/server/safe-action";
import {
  deletePushSubscription,
  markRead,
  markUnread,
  savePushSubscription,
  setPreference,
  setWatching,
} from "./service";

export const markReadAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), ids: z.array(z.string()).max(200).optional() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    const count = await markRead({
      userId: ctx.user.id,
      workspaceId: workspace.id,
      ids: parsedInput.ids,
    });
    refresh();
    return { count };
  });

export const markUnreadAction = authActionClient
  .inputSchema(z.object({ id: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    await markUnread({ userId: ctx.user.id, id: parsedInput.id });
    refresh();
  });

export const setPreferenceAction = authActionClient
  .inputSchema(
    z.object({
      type: z.enum(NOTIFICATION_TYPES),
      channels: z.object({ inApp: z.boolean(), email: z.boolean(), push: z.boolean() }),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    await setPreference({ userId: ctx.user.id, ...parsedInput });
    refresh();
  });

export const setWatchingAction = authActionClient
  .inputSchema(z.object({ issueId: z.string(), watching: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => {
    await setWatching({ userId: ctx.user.id, ...parsedInput });
    refresh();
  });

export const savePushSubscriptionAction = authActionClient
  .inputSchema(
    z.object({
      endpoint: z.string().url().max(1000),
      p256dh: z.string().max(200),
      auth: z.string().max(100),
      userAgent: z.string().max(300).default(""),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    await savePushSubscription({ userId: ctx.user.id, ...parsedInput });
    refresh();
  });

export const deletePushSubscriptionAction = authActionClient
  .inputSchema(z.object({ endpoint: z.string().max(1000) }))
  .action(async ({ parsedInput, ctx }) => {
    await deletePushSubscription({ userId: ctx.user.id, endpoint: parsedInput.endpoint });
    refresh();
  });
