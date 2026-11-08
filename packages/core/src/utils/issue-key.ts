const PROJECT_KEY_RE = /^[A-Z][A-Z0-9]{1,9}$/;
const ISSUE_KEY_RE = /^([A-Z][A-Z0-9]{1,9})-(\d+)$/;

/** Project keys are 2–10 chars, uppercase letters/digits, starting with a letter (e.g. PAY, MOB2). */
export function isValidProjectKey(key: string): boolean {
  return PROJECT_KEY_RE.test(key);
}

/** Suggests a project key from a name: "Payments Platform" → "PP", "Mobile" → "MOB". */
export function suggestProjectKey(name: string): string {
  const words = name
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "PRJ";
  const raw =
    words.length === 1
      ? (words[0] ?? "").slice(0, 3)
      : words
          .map((w) => w[0])
          .join("")
          .slice(0, 4);
  const key = raw.toUpperCase().replace(/^[0-9]+/, "");
  return key.length >= 2 ? key : (key + "X").slice(0, 2);
}

export function formatIssueKey(projectKey: string, number: number): string {
  return `${projectKey}-${number}`;
}

export function parseIssueKey(key: string): { projectKey: string; number: number } | null {
  const match = ISSUE_KEY_RE.exec(key.trim().toUpperCase());
  if (!match) return null;
  return { projectKey: match[1]!, number: Number(match[2]) };
}
