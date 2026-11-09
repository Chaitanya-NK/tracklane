import "server-only";
import { db } from "@tracklane/db";

export async function getAccountOverview(userId: string) {
  const live = { userId, expiresAt: { gt: new Date() } };
  const [sessions, sessionCount, accounts] = await Promise.all([
    db.session.findMany({
      where: live,
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: { id: true, userAgent: true, ipAddress: true, createdAt: true, updatedAt: true },
    }),
    db.session.count({ where: live }),
    db.account.findMany({
      where: { userId },
      select: { id: true, providerId: true },
    }),
  ]);
  return {
    sessions,
    sessionCount,
    linked: accounts
      .filter((a) => a.providerId !== "credential")
      .map((a) => ({ id: a.id, providerId: a.providerId })),
    hasPassword: accounts.some((a) => a.providerId === "credential"),
  };
}

export type AccountOverview = Awaited<ReturnType<typeof getAccountOverview>>;
