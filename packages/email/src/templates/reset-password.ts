import { escapeHtml, renderLayout, type RenderedEmail } from "../layout";

export function resetPasswordEmail(input: { name: string; url: string }): RenderedEmail {
  const subject = "Reset your Tracklane password";
  return {
    subject,
    html: renderLayout({
      preheader: "Use this link to choose a new password. It expires in 1 hour.",
      heading: "Reset your password",
      paragraphs: [
        `Hi ${escapeHtml(input.name)},`,
        "Someone asked to reset the password for your Tracklane account. If that was you, choose a new password below. The link expires in 1 hour.",
      ],
      action: { label: "Choose a new password", url: input.url },
      footnote:
        "If you didn't ask for this, you can ignore this email — your password won't change.",
    }),
    text: `Hi ${input.name},\n\nReset your Tracklane password (link expires in 1 hour):\n${input.url}\n\nIf you didn't ask for this, ignore this email.`,
  };
}
