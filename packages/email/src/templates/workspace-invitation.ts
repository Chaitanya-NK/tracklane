import { escapeHtml, renderLayout, type RenderedEmail } from "../layout";

export function workspaceInvitationEmail(input: {
  inviterName: string;
  workspaceName: string;
  roleLabel: string;
  url: string;
  expiresInDays: number;
}): RenderedEmail {
  const subject = `${input.inviterName} invited you to ${input.workspaceName} on Tracklane`;
  return {
    subject,
    html: renderLayout({
      preheader: `Join ${input.workspaceName} as ${input.roleLabel}.`,
      heading: `Join ${input.workspaceName}`,
      paragraphs: [
        `${escapeHtml(input.inviterName)} invited you to the <strong>${escapeHtml(input.workspaceName)}</strong> workspace as <strong>${escapeHtml(input.roleLabel)}</strong>.`,
        `The invitation expires in ${input.expiresInDays} days.`,
      ],
      action: { label: "Accept invitation", url: input.url },
      footnote: "If you weren't expecting this invitation, you can ignore this email.",
    }),
    text: `${input.inviterName} invited you to ${input.workspaceName} on Tracklane as ${input.roleLabel}.\n\nAccept: ${input.url}\n\nExpires in ${input.expiresInDays} days.`,
  };
}
