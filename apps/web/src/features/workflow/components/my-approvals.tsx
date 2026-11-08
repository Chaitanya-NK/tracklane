import { ShieldCheckIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { TimeAgo } from "@/components/shared/time-ago";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IssueTypeIcon, StatusBadge } from "@/features/issues";
import { getWorkspaceAccess } from "@/server/authz";
import { listApprovalsForUser } from "../server/approvals";

/** Home page card: status changes the user can approve. Renders nothing when there are none. */
export async function MyApprovals({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params;
  const { workspace, user, role } = await getWorkspaceAccess(slug);
  const requests = await listApprovalsForUser(workspace.id, user.id, role);
  if (!requests.length) return null;
  return (
    <Card className="border-amber-500/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheckIcon className="size-4 text-amber-600" aria-hidden="true" />
          Waiting for your approval
        </CardTitle>
        <CardDescription>
          {requests.length} status {requests.length === 1 ? "change needs" : "changes need"} a
          sign-off. Open an issue to approve or reject.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {requests.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
              <IssueTypeIcon type={r.issue.type} />
              <Link
                href={`/${slug}/issues/${r.key}` as Route}
                className="font-mono text-xs text-muted-foreground hover:underline"
              >
                {r.key}
              </Link>
              <Link
                href={`/${slug}/issues/${r.key}` as Route}
                className="min-w-0 flex-1 truncate font-medium hover:underline"
              >
                {r.issue.title}
              </Link>
              <span className="flex items-center gap-1.5">
                <StatusBadge status={r.from} /> → <StatusBadge status={r.to} />
              </span>
              <span className="text-xs text-muted-foreground">
                {r.requestedBy?.name ?? "Former member"} · <TimeAgo date={r.createdAt} />
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
