import { ISSUE_TYPE_LABELS, type IssueType } from "../constants";

const SECTION_ORDER: IssueType[] = ["epic", "story", "task", "bug", "subtask"];
const SECTION_TITLES: Record<IssueType, string> = {
  epic: "Highlights",
  story: "New features",
  task: "Improvements",
  bug: "Bug fixes",
  subtask: "Other changes",
};

/** Markdown release notes: resolved issues grouped by type, open ones listed as known issues. */
export function releaseNotes(input: {
  projectName: string;
  release: { name: string; description: string; releaseDate: string | null };
  issues: { key: string; title: string; type: IssueType; done: boolean }[];
}): string {
  const lines = [`# ${input.projectName} ${input.release.name}`];
  if (input.release.releaseDate) lines.push(`_Released ${input.release.releaseDate}_`);
  if (input.release.description) lines.push("", input.release.description);
  const done = input.issues.filter((i) => i.done);
  for (const type of SECTION_ORDER) {
    const items = done.filter((i) => i.type === type);
    if (!items.length) continue;
    lines.push("", `## ${SECTION_TITLES[type]}`, ...items.map((i) => `- ${i.title} (${i.key})`));
  }
  const open = input.issues.filter((i) => !i.done);
  if (open.length) {
    lines.push(
      "",
      "## Known issues",
      ...open.map((i) => `- ${i.title} (${i.key}, ${ISSUE_TYPE_LABELS[i.type].toLowerCase()})`),
    );
  }
  if (!input.issues.length) lines.push("", "_No issues in this release yet._");
  return `${lines.join("\n")}\n`;
}
