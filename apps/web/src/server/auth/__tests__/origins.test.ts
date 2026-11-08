import { describe, expect, it } from "vitest";
import { authTrustedOrigins } from "../origins";

describe("authTrustedOrigins", () => {
  const codespace = "https://demo-3000.app.github.dev";

  it("trusts the app URL and localhost in development", () => {
    expect(authTrustedOrigins(codespace, "development")).toEqual([
      codespace,
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]);
  });

  it("trusts only the app URL in production", () => {
    expect(authTrustedOrigins(`${codespace}/`, "production")).toEqual([codespace]);
  });
});
