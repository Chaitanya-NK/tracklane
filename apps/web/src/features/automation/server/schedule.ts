import "server-only";
import { after } from "next/server";

export type AutomationEvent =
  | {
      trigger: "issue_created" | "assignee_changed" | "priority_changed" | "comment_added";
      issueId: string;
      projectId: string;
    }
  | { trigger: "status_changed"; issueId: string; projectId: string; toStatusId: string };

/**
 * Runs matching automation rules once the current request has responded (and its transaction
 * has committed). The engine is imported lazily: it calls back into the issue service.
 * Changes made by automation itself never schedule more automation (no loops).
 */
export function scheduleAutomation(events: AutomationEvent[]) {
  if (!events.length) return;
  const run = () => import("./engine").then((m) => m.runAutomations(events));
  try {
    after(run);
  } catch {
    // Outside a request (scripts, tests): run on the next tick.
    setTimeout(() => void run(), 0);
  }
}
