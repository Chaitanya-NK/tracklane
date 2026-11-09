import "server-only";
import { AppError } from "@tracklane/core";
import { db } from "@tracklane/db";

/** Ends one of the user's sessions. The current one goes through Sign out instead. */
export async function revokeSession(input: {
  userId: string;
  sessionId: string;
  currentSessionId: string | null;
}) {
  if (input.sessionId === input.currentSessionId) {
    throw new AppError("validation_failed", "Use Sign out to end this session");
  }
  const { count } = await db.session.deleteMany({
    where: { id: input.sessionId, userId: input.userId },
  });
  if (!count) throw new AppError("not_found", "That session has already ended");
}

/** Ends every session except the current one. */
export async function revokeOtherSessions(userId: string, currentSessionId: string | null) {
  const { count } = await db.session.deleteMany({
    where: { userId, ...(currentSessionId ? { id: { not: currentSessionId } } : {}) },
  });
  return { count };
}
