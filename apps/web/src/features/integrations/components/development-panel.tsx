import { GitBranchIcon, GitCommitHorizontalIcon, GitPullRequestIcon } from "lucide-react";
import { TimeAgo } from "@/components/shared/time-ago";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DevLink {
  id: string;
  kind: "branch" | "pull_request" | "commit";
  title: string;
  url: string;
  state: string | null;
  author: string;
  updatedAt: Date;
}

const ICON = {
  branch: GitBranchIcon,
  pull_request: GitPullRequestIcon,
  commit: GitCommitHorizontalIcon,
} as const;

const STATE_TONE: Record<string, string> = {
  open: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  merged: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  closed: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
};

/** Branches, pull requests and commits that mention the issue (from the GitHub integration). */
export function DevelopmentPanel({ links }: { links: DevLink[] }) {
  if (!links.length) return null;
  const counts = {
    branch: links.filter((l) => l.kind === "branch").length,
    pull_request: links.filter((l) => l.kind === "pull_request").length,
    commit: links.filter((l) => l.kind === "commit").length,
  };
  return (
    <section aria-labelledby="dev-panel" className="space-y-1.5 px-2">
      <h3 id="dev-panel" className="text-xs font-medium text-muted-foreground">
        Development · {counts.pull_request} PR{counts.pull_request === 1 ? "" : "s"} ·{" "}
        {counts.branch} branch{counts.branch === 1 ? "" : "es"} · {counts.commit} commit
        {counts.commit === 1 ? "" : "s"}
      </h3>
      <ul className="space-y-1">
        {links.slice(0, 8).map((link) => {
          const Icon = ICON[link.kind];
          return (
            <li key={link.id} className="flex items-center gap-2 text-sm">
              <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <a
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate hover:underline"
              >
                {link.title}
              </a>
              {link.state ? (
                <Badge variant="secondary" className={cn("h-5 capitalize", STATE_TONE[link.state])}>
                  {link.state}
                </Badge>
              ) : (
                <TimeAgo date={link.updatedAt} className="text-xs text-muted-foreground" />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
