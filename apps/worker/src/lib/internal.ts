import { env } from "../env";
import { logger } from "./logger";

/** Same derivation as apps/web/src/server/internal.ts. */
async function internalToken(secret: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`tracklane-internal:${secret}`),
  );
  return Buffer.from(bytes).toString("base64url");
}

/**
 * POSTs to one of the web app's /api/internal endpoints. Work that needs TQL (compiled by the
 * web app) or the issue service runs there; the worker only keeps time.
 */
export async function callInternal(path: string, label: string) {
  if (!env.BETTER_AUTH_SECRET) return;
  const res = await fetch(new URL(path, env.INTERNAL_APP_URL), {
    method: "POST",
    headers: { authorization: `Bearer ${await internalToken(env.BETTER_AUTH_SECRET)}` },
  }).catch((error: unknown) => {
    logger.warn({ error }, `${label}: web app unreachable`);
    return null;
  });
  if (res && !res.ok) logger.warn({ status: res.status }, `${label} failed`);
  else if (res) logger.debug(await res.json(), `${label} done`);
}
