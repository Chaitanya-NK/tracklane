import { snapshotAllProjects } from "@tracklane/db";
import { logger } from "../lib/logger";
import type { JobDefinition } from "./types";

/** Hourly, so today's row stays current and a missed run costs at most an hour. */
export const projectSnapshotsJob: JobDefinition = {
  name: "reports.snapshot",
  cron: "7 * * * *",
  runOnStart: true,
  handler: async () => {
    const count = await snapshotAllProjects();
    logger.debug({ projects: count }, "project snapshots stored");
  },
};
