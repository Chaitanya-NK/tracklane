/** Helpers for outside integrations (GitHub, Slack, CSV import). Pure functions. */

const KEY = /\b([A-Z][A-Z0-9]{1,9})-(\d{1,7})\b/g;

/** Issue keys mentioned in text ("Fix WEB-12 and WEB-3" → ["WEB-12", "WEB-3"]), unique. */
export function findIssueKeys(text: string): string[] {
  return [...new Set([...text.toUpperCase().matchAll(KEY)].map((m) => `${m[1]}-${m[2]}`))];
}

export interface SmartCommit {
  key: string;
  /** "#done", "#in-progress" → status name to move to (matched loosely). */
  transition: string | null;
  comment: string | null;
  /** "#time 1h 30m" → minutes. */
  timeMinutes: number | null;
}

/**
 * Smart commits: "WEB-12 #done #comment Fixed the race #time 2h" per issue key in a commit
 * message. Commands apply to the keys that precede them on the same line.
 */
export function parseSmartCommits(message: string): SmartCommit[] {
  const out: SmartCommit[] = [];
  for (const line of message.split("\n")) {
    const keys = findIssueKeys(line);
    if (!keys.length) continue;
    const commands = [...line.matchAll(/#([a-z][a-z-]*)\s*([^#]*)/gi)];
    if (!commands.length) continue;
    let transition: string | null = null;
    let comment: string | null = null;
    let timeMinutes: number | null = null;
    for (const [, name, rest] of commands) {
      const cmd = name!.toLowerCase();
      const arg = rest!.trim();
      if (cmd === "comment") comment = arg || null;
      else if (cmd === "time") {
        const m = /^(?:(\d+(?:\.\d+)?)h)?\s*(?:(\d+)m)?/.exec(arg);
        const minutes = m ? Math.round(Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0)) : 0;
        timeMinutes = minutes > 0 ? minutes : null;
      } else transition = cmd.replace(/-/g, " ");
    }
    for (const key of keys) out.push({ key, transition, comment, timeMinutes });
  }
  return out;
}

export interface SlackEvent {
  event: string;
  data: Record<string, unknown>;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** A short Slack message (mrkdwn) for a webhook event. */
export function slackText({ event, data }: SlackEvent): string {
  const issue = (data.issue ?? null) as Record<string, unknown> | null;
  const link = issue ? `<${str(issue.url)}|${str(issue.key)}> ${str(issue.title)}` : "";
  const status = issue?.status as { name?: string } | undefined;
  switch (event) {
    case "issue.created":
      return `:new: Created ${link}`;
    case "issue.updated":
      return `:pencil2: Updated ${link}${status?.name ? ` · now *${status.name}*` : ""}`;
    case "issue.deleted":
      return `:wastebasket: Deleted ${str((data as { key?: string }).key)}`;
    case "comment.created": {
      const comment = data.comment as { body?: string } | undefined;
      const body = str(comment?.body).slice(0, 200);
      return `:speech_balloon: Comment on ${link}${body ? `\n>${body.replace(/\n/g, "\n>")}` : ""}`;
    }
    case "release.released": {
      const release = data.release as { name?: string } | undefined;
      return `:rocket: Released *${str(release?.name)}*`;
    }
    case "sprint.started":
    case "sprint.completed": {
      const sprint = data.sprint as { name?: string } | undefined;
      return `${event === "sprint.started" ? ":runner: Started" : ":checkered_flag: Completed"} *${str(sprint?.name)}*`;
    }
    default:
      return `${event}${link ? ` · ${link}` : ""}`;
  }
}

/** RFC 4180 CSV → rows of fields (quotes, escaped quotes, newlines inside quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}
