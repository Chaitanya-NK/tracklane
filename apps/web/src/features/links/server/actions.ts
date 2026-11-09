"use server";

import { LINK_CHOICES } from "@tracklane/core";
import { refresh } from "next/cache";
import { z } from "zod";
import { authActionClient } from "@/server/safe-action";
import { addLink, removeLink } from "./service";

const choices = LINK_CHOICES.map((c) => c.value) as [string, ...string[]];

export const addLinkAction = authActionClient
  .inputSchema(
    z.object({
      issueId: z.string(),
      choice: z.enum(choices),
      otherKey: z.string().trim().min(1, "Enter an issue key").max(30),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    await addLink({
      ...parsedInput,
      choice: parsedInput.choice as (typeof LINK_CHOICES)[number]["value"],
      userId: ctx.user.id,
    });
    refresh();
  });

export const removeLinkAction = authActionClient
  .inputSchema(z.object({ linkId: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    await removeLink({ linkId: parsedInput.linkId, userId: ctx.user.id });
    refresh();
  });
