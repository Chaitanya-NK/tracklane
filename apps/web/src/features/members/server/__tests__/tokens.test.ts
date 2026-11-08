// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { createInvitationToken, hashInvitationToken } = await import("../tokens");

describe("invitation tokens", () => {
  it("creates url-safe tokens whose hash is reproducible", () => {
    const { token, tokenHash } = createInvitationToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tokenHash).toHaveLength(64);
    expect(hashInvitationToken(token)).toBe(tokenHash);
  });

  it("never repeats", () => {
    const a = createInvitationToken();
    const b = createInvitationToken();
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });
});
