import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { rateLimit } = await import("./rate-limit");

describe("rateLimit", () => {
  it("allows up to the limit within the window, then throws", () => {
    const opts = { limit: 2, windowMs: 1000 };
    rateLimit("t", "a", opts);
    rateLimit("t", "a", opts);
    expect(() => rateLimit("t", "a", opts)).toThrow(/Too many/);
    rateLimit("t", "b", opts); // other keys unaffected
  });
  it("frees up after the window", () => {
    vi.useFakeTimers();
    const opts = { limit: 1, windowMs: 1000 };
    rateLimit("w", "a", opts);
    vi.advanceTimersByTime(1001);
    expect(() => rateLimit("w", "a", opts)).not.toThrow();
    vi.useRealTimers();
  });
});
