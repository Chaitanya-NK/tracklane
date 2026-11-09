import "server-only";
import { db } from "@tracklane/db";

const DAY = 86_400_000;

/** REST API traffic for the last 7 days: headline numbers, per-day counts, latest calls. */
export async function getApiUsage(workspaceId: string, now = new Date()) {
  const since = new Date(now.getTime() - 7 * DAY);
  const [logs, recent, tokens] = await Promise.all([
    db.apiRequestLog.findMany({
      where: { workspaceId, createdAt: { gte: since } },
      select: { createdAt: true, status: true, durationMs: true, tokenId: true },
      take: 100_000,
    }),
    db.apiRequestLog.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        method: true,
        path: true,
        status: true,
        durationMs: true,
        createdAt: true,
        tokenId: true,
      },
    }),
    db.apiToken.findMany({ where: { workspaceId }, select: { id: true, name: true } }),
  ]);
  const day = now.getTime() - DAY;
  const last24 = logs.filter((l) => l.createdAt.getTime() >= day);
  const durations = last24.map((l) => l.durationMs).sort((a, b) => a - b);
  const p95 = durations.length
    ? durations[Math.min(durations.length - 1, Math.ceil(durations.length * 0.95) - 1)]!
    : null;
  const days = Array.from({ length: 7 }, (_, i) => {
    const start = new Date(new Date(now.toISOString().slice(0, 10)).getTime() - (6 - i) * DAY);
    const end = start.getTime() + DAY;
    const inDay = logs.filter((l) => l.createdAt >= start && l.createdAt.getTime() < end);
    return {
      date: start.toISOString().slice(0, 10),
      ok: inDay.filter((l) => l.status < 400).length,
      errors: inDay.filter((l) => l.status >= 400).length,
    };
  });
  const names = new Map(tokens.map((t) => [t.id, t.name]));
  return {
    stats: {
      requests: last24.length,
      errorRate: last24.length
        ? Math.round((last24.filter((l) => l.status >= 400).length / last24.length) * 1000) / 10
        : 0,
      p95,
      rateLimited: last24.filter((l) => l.status === 429).length,
    },
    days,
    recent: recent.map((r) => ({
      ...r,
      token: r.tokenId ? (names.get(r.tokenId) ?? "Deleted token") : "—",
    })),
  };
}

export type ApiUsage = Awaited<ReturnType<typeof getApiUsage>>;
