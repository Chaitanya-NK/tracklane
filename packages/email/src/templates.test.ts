import { describe, expect, it } from "vitest";
import { resetPasswordEmail, workspaceInvitationEmail } from "./index";

describe("email templates", () => {
  it("escapes user content", () => {
    const email = workspaceInvitationEmail({
      inviterName: "<script>alert(1)</script>",
      workspaceName: "Acme & Co",
      roleLabel: "Member",
      url: "https://example.test/invite/abc",
      expiresInDays: 7,
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("Acme &amp; Co");
    expect(email.text).toContain("https://example.test/invite/abc");
  });

  it("renders the reset link", () => {
    const email = resetPasswordEmail({ name: "Dev", url: "https://example.test/reset?token=1" });
    expect(email.subject).toMatch(/reset/i);
    expect(email.html).toContain("https://example.test/reset?token=1");
  });
});
