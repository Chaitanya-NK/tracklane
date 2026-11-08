// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/storage", () => ({ storage: () => ({}), MAX_UPLOAD_BYTES: 10 }));
vi.mock("@/server/authz", () => ({}));
vi.mock("@tracklane/db", () => ({ db: {} }));
vi.mock("../server/service", () => ({}));
const { isInlineSafe, sanitizeFilename } = await import("../server/attachments");

describe("attachment helpers", () => {
  it("only inlines raster images", () => {
    expect(isInlineSafe("image/png")).toBe(true);
    expect(isInlineSafe("image/svg+xml")).toBe(false);
    expect(isInlineSafe("text/html")).toBe(false);
  });

  it("sanitizes filenames", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename('C:\\Users\\me\\re"port.pdf')).toBe("report.pdf");
    expect(sanitizeFilename("  ")).toBe("file");
  });
});
