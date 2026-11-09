import { deliverNotificationsJob } from "./deliver-notifications";
import { heartbeatJob } from "./heartbeat";
import type { JobDefinition } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const jobs: JobDefinition<any>[] = [heartbeatJob, deliverNotificationsJob];
