import { checkDatabase } from "@tracklane/db";
import { logger } from "../lib/logger";
import type { JobDefinition } from "./types";

/** Runs every 5 minutes so we can see the worker is alive and the DB is reachable. */
export const heartbeatJob: JobDefinition = {
  name: "system.heartbeat",
  cron: "*/5 * * * *",
  handler: async () => {
    const health = await checkDatabase();
    if (health.ok) logger.debug({ latencyMs: health.latencyMs }, "heartbeat ok");
    else logger.error({ error: health.error }, "heartbeat: database unreachable");
  },
};
