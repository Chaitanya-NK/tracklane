import "server-only";
import { db } from "@tracklane/db";

/** Remembers that the user opened an issue (for the "Viewed" tab). */
export async function recordIssueView(userId: string, issueId: string) {
  await db.issueView.upsert({
    where: { userId_issueId: { userId, issueId } },
    create: { userId, issueId },
    update: { viewedAt: new Date() },
  });
}

export async function isStarred(userId: string, issueId: string) {
  return Boolean(
    await db.issueStar.findUnique({
      where: { userId_issueId: { userId, issueId } },
      select: { userId: true },
    }),
  );
}
