import { describe, expect, it } from "vitest";
import { resetPasswordSchema, signUpSchema } from "../schemas";

describe("auth schemas", () => {
  it("normalises sign-up email and enforces password length", () => {
    expect(
      signUpSchema.parse({ name: " Priya ", email: " Priya@Acme.dev ", password: "longenough" }),
    ).toEqual({
      name: "Priya",
      email: "priya@acme.dev",
      password: "longenough",
    });
    expect(
      signUpSchema.safeParse({ name: "P", email: "p@acme.dev", password: "short" }).success,
    ).toBe(false);
  });

  it("requires matching passwords on reset", () => {
    const result = resetPasswordSchema.safeParse({ password: "longenough", confirm: "different" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["confirm"]);
  });
});
