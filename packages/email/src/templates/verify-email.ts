import { escapeHtml, renderLayout, type RenderedEmail } from "../layout";

export function verifyEmailEmail(input: { name: string; url: string }): RenderedEmail {
  return {
    subject: "Confirm your email for Tracklane",
    html: renderLayout({
      preheader: "Confirm it's you so we can send you updates.",
      heading: "Confirm your email",
      paragraphs: [
        `Hi ${escapeHtml(input.name)}, please confirm this is your email address so Tracklane can send you notifications.`,
      ],
      action: { label: "Confirm email", url: input.url },
      footnote: "If you didn't create a Tracklane account, you can ignore this email.",
    }),
    text: `Hi ${input.name},\n\nConfirm your email for Tracklane: ${input.url}\n\nIf you didn't sign up, ignore this email.`,
  };
}
