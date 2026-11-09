import { callInternal } from "../lib/internal";
import type { JobDefinition } from "./types";

/**
 * Every 5 minutes, asks the web app to check SLA clocks (the policies are TQL, which the web
 * app compiles) and notify owners of issues at risk or breached.
 */
export const slaCheckJob: JobDefinition = {
  name: "sla.check",
  cron: "*/5 * * * *",
  handler: () => callInternal("/api/internal/sla-check", "SLA check"),
};
