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

/** The history tab: who changed what, newest first. */
export function IssueActivity({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No history yet.</p>;
  return (
    <ol className="space-y-4">
      {items.map((item) => (
        <li key={item.id} className="flex gap-3 text-sm">
          <UserAvatar user={item.actor ?? { name: "?" }} className="mt-0.5 size-6" />
          <p className="leading-6">
            <span className="font-medium">{item.actor?.name ?? "Former member"}</span>{" "}
            {describe(item)} <span className="text-muted-foreground">· </span>
            <TimeAgo date={item.createdAt} className="text-muted-foreground" />
          </p>
        </li>
      ))}
    </ol>
  );
}
