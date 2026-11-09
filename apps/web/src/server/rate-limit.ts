import "server-only";
import { AppError } from "@tracklane/core";

const buckets = new Map<string, Map<string, number[]>>();
const MAX_KEYS = 10_000;

/**
 * Sliding-window limit kept in memory, per server instance: enough to blunt spam on public
 * endpoints without extra infrastructure. Throws `rate_limited` when exceeded.
 */
export function rateLimit(
  bucket: string,
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
) {
  const now = Date.now();
  let map = buckets.get(bucket);
  if (!map) buckets.set(bucket, (map = new Map()));
  if (map.size > MAX_KEYS) {
    for (const [k, times] of map) if (!times.some((t) => now - t < windowMs)) map.delete(k);
    if (map.size > MAX_KEYS) map.clear(); // still flooded: start over rather than grow
  }
  const times = (map.get(key) ?? []).filter((t) => now - t < windowMs);
  if (times.length >= limit) {
    throw new AppError("rate_limited", "Too many requests from here. Try again in a few minutes.");
  }
  times.push(now);
  map.set(key, times);
}

/** Best-effort client IP from proxy headers. */
export function clientIp(h: Headers): string {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
