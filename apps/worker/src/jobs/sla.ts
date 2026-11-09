import { env } from "../env";
import { logger } from "../lib/logger";
import type { JobDefinition } from "./types";

/**
 * Every 5 minutes, asks the web app to check SLA clocks (the policies are TQL, which the web
 * app compiles) and notify owners of issues at risk or breached. Authenticated with a secret
 * derived from BETTER_AUTH_SECRET.
 */
export const slaCheckJob: JobDefinition = {
  name: "sla.check",
  cron: "*/5 * * * *",
  handler: async () => {
    if (!env.BETTER_AUTH_SECRET) return;
    const res = await fetch(new URL("/api/internal/sla-check", env.INTERNAL_APP_URL), {
      method: "POST",
      headers: { authorization: `Bearer ${await internalToken(env.BETTER_AUTH_SECRET)}` },
    }).catch((error: unknown) => {
      logger.warn({ error }, "SLA check: web app unreachable");
      return null;
    });
    if (res && !res.ok) logger.warn({ status: res.status }, "SLA check failed");
    else if (res) logger.debug(await res.json(), "SLA check done");
  },
};

/** Same derivation as apps/web/src/server/internal.ts. */
async function internalToken(secret: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`tracklane-internal:${secret}`),
  );
  return Buffer.from(bytes).toString("base64url");
}
