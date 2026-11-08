import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** A URL-safe random token and the hash we store. The raw token only ever lives in the email. */
export function createInvitationToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashInvitationToken(token) };
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
