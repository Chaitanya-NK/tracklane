"use server";

import { refresh } from "next/cache";
import { authActionClient } from "@/server/safe-action";
import { profileSchema } from "../model";
import { removeAvatar, updateProfile } from "./service";

export const updateProfileAction = authActionClient
  .inputSchema(profileSchema)
  .action(async ({ parsedInput, ctx }) => {
    await updateProfile(ctx.user.id, parsedInput);
    refresh();
  });

/** Uploads go through POST /api/avatars (multipart), like attachments. */
export const removeAvatarAction = authActionClient.action(async ({ ctx }) => {
  await removeAvatar(ctx.user.id);
  refresh();
});
