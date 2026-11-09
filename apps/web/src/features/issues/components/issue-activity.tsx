import { Markdown } from "@/components/shared/markdown";
import { TimeAgo } from "@/components/shared/time-ago";
import { UserAvatar } from "@/components/shared/user-avatar";

export interface ActivityItem {
  id: string;
  action: string;
  field: string | null;
  fromValue: string | null;
  toValue: string | null;
  createdAt: Date;
  actor: { id: string; name: string; image: string | null } | null;
}

const FIELD_LABELS: Record<string, string> = {
  title: "summary",
  description: "description",
  type: "type",
  priority: "priority",
  status: "status",
  assignee: "assignee",
  dueDate: "due date",
  startDate: "start date",
  estimate: "story points",
  parent: "parent",
  labels: "labels",
  sprint: "sprint",
  resolution: "resolution",
  timeEstimate: "time estimate",
  release: "release",
  components: "components",
};

function Value({ children }: { children: string | null }) {
  return children ? (
    <span className="rounded bg-muted px-1 py-0.5 text-xs font-medium">{children}</span>
  ) : (
    <span className="text-muted-foreground italic">None</span>
  );
}

function describe(item: ActivityItem) {
  switch (item.action) {
    case "created":
      return <>created the issue</>;
    case "commented":
      return <>added a comment</>;
    case "attachment_added":
      return (
        <>
          attached <Value>{item.toValue}</Value>
        </>
      );
    case "attachment_removed":
      return (
        <>
          removed the attachment <Value>{item.fromValue}</Value>
        </>
      );
    case "approval_requested":
      return (
        <>
          asked for approval to move from <Value>{item.fromValue}</Value> to{" "}
          <Value>{item.toValue}</Value>
        </>
      );
    case "approval_approved":
      return (
        <>
          approved the move to <Value>{item.toValue}</Value>
        </>
      );
    case "approval_rejected":
      return (
        <>
          rejected the move to <Value>{item.toValue}</Value>
        </>
      );
    case "approval_cancelled":
      return (
        <>
          withdrew the request to move to <Value>{item.toValue}</Value>
        </>
      );
    case "field_set":
      return (
        <>
          set {item.field} to <Value>{item.toValue}</Value>
        </>
      );
    case "work_logged":
      return (
        <>
          logged <Value>{item.toValue}</Value>
        </>
      );
    case "flagged":
      return <>flagged the issue</>;
    case "unflagged":
      return <>removed the flag</>;
    case "field_cleared":
      return <>cleared {item.field}</>;
    default: {
      const field = FIELD_LABELS[item.field ?? ""] ?? item.field;
      if (item.field === "description") return <>updated the description</>;
      return (
        <>
          changed the {field} from <Value>{item.fromValue}</Value> to <Value>{item.toValue}</Value>
        </>
      );
    }
  }
}

/**
 * The history tab: who changed what, newest first. With `comments`, an "All activity" feed that
 * interleaves comments (shown in full) with changes.
 */
export function IssueActivity({
  items,
  comments,
}: {
  items: ActivityItem[];
  comments?: {
    id: string;
    body: string;
    createdAt: Date;
    parentId: string | null;
    author: { id: string; name: string; image: string | null } | null;
  }[];
}) {
  type Entry =
    | { kind: "change"; at: number; item: ActivityItem }
    | { kind: "comment"; at: number; comment: NonNullable<typeof comments>[number] };
  const entries: Entry[] = [
    ...items
      .filter((i) => !comments || i.action !== "commented")
      .map((item) => ({ kind: "change" as const, at: new Date(item.createdAt).getTime(), item })),
    ...(comments ?? []).map((comment) => ({
      kind: "comment" as const,
      at: new Date(comment.createdAt).getTime(),
      comment,
    })),
  ].sort((a, b) => b.at - a.at);

  if (entries.length === 0) return <p className="text-sm text-muted-foreground">No history yet.</p>;
  return (
    <ol className="space-y-4">
      {entries.map((entry) =>
        entry.kind === "change" ? (
          <li key={entry.item.id} className="flex gap-3 text-sm">
            <UserAvatar user={entry.item.actor ?? { name: "?" }} className="mt-0.5 size-6" />
            <p className="leading-6">
              <span className="font-medium">{entry.item.actor?.name ?? "Former member"}</span>{" "}
              {describe(entry.item)} <span className="text-muted-foreground">· </span>
              <TimeAgo date={entry.item.createdAt} className="text-muted-foreground" />
            </p>
          </li>
        ) : (
          <li key={entry.comment.id} className="flex gap-3 text-sm">
            <UserAvatar user={entry.comment.author ?? { name: "?" }} className="mt-0.5 size-6" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="leading-6">
                <span className="font-medium">{entry.comment.author?.name ?? "Former member"}</span>{" "}
                {entry.comment.parentId ? "replied" : "commented"}{" "}
                <span className="text-muted-foreground">· </span>
                <TimeAgo date={entry.comment.createdAt} className="text-muted-foreground" />
              </p>
              <div className="rounded-md border bg-muted/30 px-3 py-2">
                <Markdown>{entry.comment.body}</Markdown>
              </div>
            </div>
          </li>
        ),
      )}
    </ol>
  );
}
