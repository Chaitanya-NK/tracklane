import { describe, expect, it } from "vitest";
import { safeCallbackUrl } from "../safe-redirect";

describe("safeCallbackUrl", () => {
  it("keeps same-site paths", () => {
    expect(safeCallbackUrl("/acme/projects?tab=1")).toBe("/acme/projects?tab=1");
    expect(safeCallbackUrl("/invite/abc")).toBe("/invite/abc");
  });

  it("rejects external and protocol-relative urls", () => {
    expect(safeCallbackUrl("https://evil.test")).toBe("/");
    expect(safeCallbackUrl("//evil.test")).toBe("/");
    expect(safeCallbackUrl("/\\evil.test")).toBe("/");
    expect(safeCallbackUrl("javascript:alert(1)")).toBe("/");
    expect(safeCallbackUrl(null, "/onboarding")).toBe("/onboarding");
  });
});
