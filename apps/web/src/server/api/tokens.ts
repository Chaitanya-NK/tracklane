import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** "tl_" + 43 url-safe characters (256 bits). */
export function generateApiToken() {
  const token = `tl_${randomBytes(32).toString("base64url")}`;
  return { token, prefix: token.slice(0, 10), hash: hashApiToken(token) };
}

export const hashApiToken = (token: string) => createHash("sha256").update(token).digest("hex");
