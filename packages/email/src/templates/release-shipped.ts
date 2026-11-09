import { escapeHtml, renderLayout, type RenderedEmail } from "../layout";

/** Sent to roadmap subscribers when a release ships. */
export function releaseShippedEmail(input: {
  projectName: string;
  releaseName: string;
  description: string;
  items: string[];
  roadmapUrl: string;
}): RenderedEmail {
  const subject = `${input.projectName} ${input.releaseName} is out`;
  return {
    subject,
    html: renderLayout({
      preheader: subject,
      heading: subject,
      paragraphs: [
        ...(input.description ? [escapeHtml(input.description)] : []),
        ...input.items.slice(0, 10).map((i) => `• ${escapeHtml(i)}`),
      ],
      action: { label: "See the roadmap", url: input.roadmapUrl },
      footnote: "You subscribed to updates on this roadmap.",
    }),
    text: [subject, input.description, ...input.items.map((i) => `- ${i}`), input.roadmapUrl]
      .filter(Boolean)
      .join("\n\n"),
  };
}
