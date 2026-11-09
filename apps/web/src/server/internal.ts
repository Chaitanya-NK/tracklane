import "server-only";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/env";

/** Bearer token the worker uses for /api/internal/* (derived, so no extra secret to manage). */
async function internalToken() {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`tracklane-internal:${env.BETTER_AUTH_SECRET}`),
  );
  return Buffer.from(bytes).toString("base64url");
}

export async function isInternalRequest(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const given = Buffer.from(header.replace(/^Bearer /, ""));
  const expected = Buffer.from(await internalToken());
  return given.length === expected.length && timingSafeEqual(given, expected);
}
