import { escapeHtml, renderLayout, type RenderedEmail } from "../layout";

export interface FilterDigestIssue {
  key: string;
  title: string;
  status: string;
  /** Absolute URL. */
  url: string;
}

/** A subscribed filter's current results (daily or weekly). */
export function filterDigestEmail(input: {
  filterName: string;
  workspaceName: string;
  total: number;
  issues: FilterDigestIssue[];
  filterUrl: string;
  frequency: "daily" | "weekly";
}): RenderedEmail {
  const subject = `${input.filterName}: ${input.total} issue${input.total === 1 ? "" : "s"}`;
  const rows = input.issues.map(
    (i) =>
      `<a href="${escapeHtml(i.url)}" style="color:#09090b;text-decoration:none"><span style="font-family:ui-monospace,monospace;color:#71717a">${escapeHtml(i.key)}</span> <b style="font-weight:600">${escapeHtml(i.title)}</b></a> <span style="color:#52525b">· ${escapeHtml(i.status)}</span>`,
  );
  const more = input.total - input.issues.length;
  return {
    subject,
    html: renderLayout({
      preheader: `${input.total} issues match in ${input.workspaceName}`,
      heading: input.filterName,
      paragraphs: [
        input.total === 0
          ? "No issues match this filter right now."
          : `${input.total} issue${input.total === 1 ? "" : "s"} match in ${escapeHtml(input.workspaceName)}.`,
        ...rows,
        ...(more > 0 ? [`…and ${more} more.`] : []),
      ],
      action: { label: "Open the filter", url: input.filterUrl },
      footnote: `You subscribed to a ${input.frequency} digest of this filter. Unsubscribe from the filter's page.`,
    }),
    text: [
      subject,
      ...input.issues.map((i) => `${i.key} ${i.title} (${i.status})\n${i.url}`),
      ...(more > 0 ? [`…and ${more} more.`] : []),
      `Open: ${input.filterUrl}`,
    ].join("\n\n"),
  };
}
