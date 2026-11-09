import { deliverNotificationsJob } from "./deliver-notifications";
import { heartbeatJob } from "./heartbeat";
import { automationDailyJob, filterDigestsJob, recurringIssuesJob } from "./planning";
import { deliverWebhooksJob } from "./webhooks";
import { slaCheckJob } from "./sla";
import { retentionJob } from "./retention";
import { projectSnapshotsJob } from "./snapshots";
import type { JobDefinition } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const jobs: JobDefinition<any>[] = [
  heartbeatJob,
  deliverNotificationsJob,
  projectSnapshotsJob,
  slaCheckJob,
  automationDailyJob,
  recurringIssuesJob,
  deliverWebhooksJob,
  filterDigestsJob,
  retentionJob,
];
