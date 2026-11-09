import { describe, expect, it } from "vitest";
import {
  notificationDigestEmail,
  resetPasswordEmail,
  verifyEmailEmail,
  workspaceInvitationEmail,
} from "./index";

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

  it("batches notifications and escapes them", () => {
    const email = notificationDigestEmail({
      workspaceName: "Acme",
      inboxUrl: "https://t.test/acme/inbox",
      settingsUrl: "https://t.test/acme/settings/notifications",
      items: [
        {
          title: "Priya assigned WEB-1 to you",
          body: "<b>x</b>",
          url: "https://t.test/acme/issues/WEB-1",
        },
        { title: "Sam commented on WEB-2", body: "", url: "https://t.test/acme/issues/WEB-2" },
      ],
    });
    expect(email.subject).toBe("2 updates in Acme");
    expect(email.html).not.toContain("<b>x</b>");
    expect(email.text).toContain("https://t.test/acme/issues/WEB-2");
  });

  it("renders the verification link", () => {
    expect(verifyEmailEmail({ name: "Dev", url: "https://t.test/verify?token=1" }).html).toContain(
      "https://t.test/verify?token=1",
    );
  });
});
