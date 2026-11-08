import "server-only";
import { AppError, isAppError } from "@tracklane/core";
import { createSafeActionClient, DEFAULT_SERVER_ERROR_MESSAGE } from "next-safe-action";
import type { ActionError } from "@/lib/action-error";
import { getCurrentUser } from "./auth";

/**
 * Base client for every Server Action. Validation errors come back as field errors;
 * AppErrors thrown by services become user-readable messages; anything else is logged and
 * replaced with a generic message so internals never leak to the browser.
 */
export const actionClient = createSafeActionClient({
  handleServerError(error): ActionError {
    if (isAppError(error)) return { message: error.message, field: error.field };
    console.error("Unhandled server action error:", error);
    return { message: DEFAULT_SERVER_ERROR_MESSAGE };
  },
});

/** Requires a signed-in user and exposes it as `ctx.user`. */
export const authActionClient = actionClient.use(async ({ next }) => {
  const user = await getCurrentUser();
  if (!user) throw new AppError("unauthorized", "Your session has expired. Sign in again.");
  return next({ ctx: { user } });
});
