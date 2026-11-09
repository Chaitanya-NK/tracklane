import { escapeHtml, renderLayout, type RenderedEmail } from "../layout";

export interface DigestItem {
  title: string;
  body: string;
  /** Absolute URL. */
  url: string;
}

/** One email for everything new since the last one (sent at most once a minute per person). */
export function notificationDigestEmail(input: {
  workspaceName: string;
  items: DigestItem[];
  inboxUrl: string;
  settingsUrl: string;
}): RenderedEmail {
  const [first] = input.items;
  const subject =
    input.items.length === 1 && first
      ? first.title
      : `${input.items.length} updates in ${input.workspaceName}`;
  const list = input.items.map(
    (item) =>
      `<a href="${escapeHtml(item.url)}" style="color:#09090b;font-weight:600;text-decoration:none">${escapeHtml(item.title)}</a>` +
      (item.body
        ? `<br><span style="color:#52525b">${escapeHtml(item.body.length > 200 ? `${item.body.slice(0, 200)}…` : item.body)}</span>`
        : ""),
  );
  return {
    subject,
    html: renderLayout({
      preheader: first?.title ?? subject,
      heading: input.items.length === 1 ? "New update" : `${input.items.length} new updates`,
      paragraphs: list,
      action: { label: "Open your inbox", url: input.inboxUrl },
      footnote: `You get these emails for the updates you chose in <a href="${escapeHtml(input.settingsUrl)}" style="color:#1d4ed8">notification settings</a>.`,
    }),
    text: [
      ...input.items.map((i) => `${i.title}${i.body ? `\n${i.body}` : ""}\n${i.url}`),
      `Inbox: ${input.inboxUrl}`,
      `Change what you get: ${input.settingsUrl}`,
    ].join("\n\n"),
  };
}
