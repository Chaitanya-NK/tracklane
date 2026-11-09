import PgBoss from "pg-boss";
import { env } from "./env";
import { jobs } from "./jobs";
import { logger } from "./lib/logger";

async function main() {
  const boss = new PgBoss({ connectionString: env.DATABASE_URL, schema: "pgboss" });
  boss.on("error", (error) => logger.error(error, "pg-boss error"));

  await boss.start();

  for (const job of jobs) {
    await boss.createQueue(job.name);
    await boss.work(job.name, job.handler);
    if (job.cron) await boss.schedule(job.name, job.cron);
    if (job.runOnStart) await boss.send(job.name, {});
    logger.info({ job: job.name, cron: job.cron ?? null }, "registered job");
  }

  logger.info("worker started");

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "worker stopping");
    await boss.stop({ graceful: true, timeout: 10_000 });
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  logger.fatal(error, "worker failed to start");
  process.exit(1);
});
