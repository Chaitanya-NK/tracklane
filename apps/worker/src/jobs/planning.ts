import { callInternal } from "../lib/internal";
import type { JobDefinition } from "./types";

/** Daily automation rules ("every day at 06:00 UTC, for issues matching…"). */
export const automationDailyJob: JobDefinition = {
  name: "automation.daily",
  cron: "0 6 * * *",
  handler: () => callInternal("/api/internal/automation-daily", "Daily automation"),
};

/** Creates any recurring issues that are due. Hourly, and once on start to catch up. */
export const recurringIssuesJob: JobDefinition = {
  name: "issues.recurring",
  cron: "5 * * * *",
  runOnStart: true,
  handler: () => callInternal("/api/internal/recurring", "Recurring issues"),
};
