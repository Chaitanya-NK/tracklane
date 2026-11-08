import { db } from "./client";

export type DatabaseHealth = { ok: true; latencyMs: number } | { ok: false; error: string };

/** Cheap round-trip used by /api/health and the worker's startup check. */
export async function checkDatabase(): Promise<DatabaseHealth> {
  const started = performance.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Math.round(performance.now() - started) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
