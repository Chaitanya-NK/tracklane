import { db } from "@tracklane/db";
import { logger } from "../lib/logger";
import type { JobDefinition } from "./types";

const DAY = 86_400_000;

/** How long operational data is kept. Documented in docs/SECURITY.md. */
export const RETENTION_DAYS = {
  apiRequestLogs: 30,
  webhookDeliveries: 30,
  automationRuns: 90,
  auditEvents: 365,
} as const;

/** Nightly cleanup of logs and expired auth records. */
export const retentionJob: JobDefinition = {
  name: "system.retention",
  cron: "17 3 * * *",
  runOnStart: true,
  handler: async () => {
    const now = Date.now();
    const before = (days: number) => new Date(now - days * DAY);
    const [api, deliveries, runs, audit, sessions, verifications] = await Promise.all([
      db.apiRequestLog.deleteMany({
        where: { createdAt: { lt: before(RETENTION_DAYS.apiRequestLogs) } },
      }),
      db.webhookDelivery.deleteMany({
        where: {
          createdAt: { lt: before(RETENTION_DAYS.webhookDeliveries) },
          status: { not: "pending" },
        },
      }),
      db.automationRun.deleteMany({
        where: { createdAt: { lt: before(RETENTION_DAYS.automationRuns) } },
      }),
      db.auditEvent.deleteMany({
        where: { createdAt: { lt: before(RETENTION_DAYS.auditEvents) } },
      }),
      db.session.deleteMany({ where: { expiresAt: { lt: new Date(now) } } }),
      db.verification.deleteMany({ where: { expiresAt: { lt: new Date(now) } } }),
    ]);
    logger.info(
      {
        apiRequestLogs: api.count,
        webhookDeliveries: deliveries.count,
        automationRuns: runs.count,
        auditEvents: audit.count,
        expiredSessions: sessions.count,
        expiredVerifications: verifications.count,
      },
      "retention cleanup",
    );
  },
};
