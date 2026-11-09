"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentSessionId } from "@/server/auth";
import { authActionClient } from "@/server/safe-action";
import { revokeOtherSessions, revokeSession } from "./service";

/** Signs out one of your other devices. */
export const revokeSessionAction = authActionClient
  .inputSchema(z.object({ sessionId: z.string().min(1) }))
  .action(async ({ parsedInput, ctx }) => {
    await revokeSession({
      userId: ctx.user.id,
      sessionId: parsedInput.sessionId,
      currentSessionId: await getCurrentSessionId(),
    });
    refresh();
  });

/** Signs out everywhere except this browser. */
export const revokeOtherSessionsAction = authActionClient.action(async ({ ctx }) => {
  const result = await revokeOtherSessions(ctx.user.id, await getCurrentSessionId());
  refresh();
  return result;
});
