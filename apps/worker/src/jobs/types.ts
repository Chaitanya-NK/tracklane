import type PgBoss from "pg-boss";

/**
 * A background job definition. Every job lives in its own file under src/jobs and is listed
 * in src/jobs/index.ts. `cron` (optional) schedules it; otherwise other apps enqueue it by name.
 */
export interface JobDefinition<TData extends object = Record<string, never>> {
  name: string;
  cron?: string;
  /** Also run once when the worker starts (catch up after downtime). */
  runOnStart?: boolean;
  handler: (jobs: PgBoss.Job<TData>[]) => Promise<void>;
}
