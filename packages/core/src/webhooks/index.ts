/** Events a webhook can subscribe to. */
export const WEBHOOK_EVENTS = [
  "issue.created",
  "issue.updated",
  "issue.deleted",
  "comment.created",
  "release.released",
  "sprint.started",
  "sprint.completed",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const WEBHOOK_EVENT_LABELS: Record<WebhookEvent, string> = {
  "issue.created": "Issue created",
  "issue.updated": "Issue updated (any field, status included)",
  "issue.deleted": "Issue deleted",
  "comment.created": "Comment added",
  "release.released": "Release shipped",
  "sprint.started": "Sprint started",
  "sprint.completed": "Sprint completed",
};

/** Header carrying `t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>">`. */
export const SIGNATURE_HEADER = "X-Tracklane-Signature";

const hex = (buffer: ArrayBuffer) =>
  [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function hmac(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
}

/** The signature header value for a delivery (Stripe-style, so replays can be rejected). */
export async function signWebhook(
  secret: string,
  body: string,
  timestamp = Math.floor(Date.now() / 1000),
) {
  return `t=${timestamp},v1=${await hmac(secret, `${timestamp}.${body}`)}`;
}

/**
 * Checks a signature header the way a receiver should: right secret, and signed within
 * `toleranceSeconds` of now.
 */
export async function verifyWebhookSignature(
  secret: string,
  body: string,
  header: string,
  toleranceSeconds = 300,
  now = Math.floor(Date.now() / 1000),
) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || !parts.v1 || Math.abs(now - t) > toleranceSeconds) return false;
  const expected = await hmac(secret, `${t}.${body}`);
  if (expected.length !== parts.v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ parts.v1.charCodeAt(i);
  return diff === 0;
}

/** Minutes to wait before retry `attempt` (1-based): 1, 5, 30, 120, 360. Undefined = give up. */
export const WEBHOOK_RETRY_MINUTES = [1, 5, 30, 120, 360] as const;
export const nextWebhookRetry = (attempt: number) => WEBHOOK_RETRY_MINUTES[attempt - 1];

/**
 * True for loopback, private, link-local, CGNAT and other non-public addresses (IPv4 and IPv6),
 * which webhooks must not reach unless explicitly allowed (SSRF protection).
 */
export function isPrivateAddress(ip: string) {
  const v4 = /^(?:::ffff:)?(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/i.exec(ip);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  return (
    v6 === "::" ||
    v6 === "::1" ||
    v6.startsWith("fc") ||
    v6.startsWith("fd") ||
    v6.startsWith("fe8") ||
    v6.startsWith("fe9") ||
    v6.startsWith("fea") ||
    v6.startsWith("feb") ||
    v6.startsWith("ff")
  );
}
