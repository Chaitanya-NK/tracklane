/**
 * Short-lived tokens the web app gives the browser to connect to the realtime server. Signed
 * with HMAC-SHA256 (Web Crypto, so it runs in Node and the browser alike). The realtime server
 * only lets a socket join rooms of the workspaces listed in its token.
 */
export interface RealtimeClaims {
  /** User id. */
  sub: string;
  name: string;
  image: string | null;
  /** Workspace ids the user belongs to. */
  ws: string[];
  /** Expiry, seconds since epoch. */
  exp: number;
}

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const padded =
    value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function key(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(`tracklane-realtime:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signRealtimeToken(claims: RealtimeClaims, secret: string): Promise<string> {
  const body = toBase64Url(encoder.encode(JSON.stringify(claims)));
  const signature = await crypto.subtle.sign("HMAC", await key(secret), encoder.encode(body));
  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

/** The claims, or null when the token is malformed, forged or expired. */
export async function verifyRealtimeToken(
  token: string,
  secret: string,
  now = Date.now(),
): Promise<RealtimeClaims | null> {
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return null;
  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await key(secret),
      fromBase64Url(signature),
      encoder.encode(body),
    );
    if (!valid) return null;
    const claims = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as RealtimeClaims;
    if (typeof claims.sub !== "string" || !Array.isArray(claims.ws) || claims.exp * 1000 < now)
      return null;
    return claims;
  } catch {
    return null;
  }
}

/** Rooms a token may join: its own user room and anything inside its workspaces. */
export function canJoinRoom(claims: RealtimeClaims, room: string) {
  if (room === `user:${claims.sub}`) return true;
  const match = /^ws:([^:]+):(project|issue):[A-Za-z0-9_-]{1,64}$/.exec(room);
  return Boolean(match && claims.ws.includes(match[1]!));
}
