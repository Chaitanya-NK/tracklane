"use client";

import { ROLE_LABELS, type StatusCategory, type WorkspaceRole } from "@tracklane/core";
import { CheckIcon, ShieldCheckIcon, XIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { Markdown } from "@/components/shared/markdown";
import { TimeAgo } from "@/components/shared/time-ago";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { IssueTypeIcon, StatusBadge } from "@/features/issues";
import { cn } from "@/lib/utils";
import type { IssueType } from "@tracklane/core";
import { cancelApprovalAction, decideApprovalAction } from "../server/actions";

export interface ApprovalRow {
  id: string;
  key: string;
  createdAt: Date;
  decidedAt: Date | null;
  state: "pending" | "approved" | "rejected" | "cancelled";
  note: string;
  approverRole: WorkspaceRole;
  from: { name: string; category: StatusCategory };
  to: { name: string; category: StatusCategory };
  requestedBy: { id: string; name: string; image: string | null } | null;
  decidedBy: { id: string; name: string } | null;
  issue: {
    title: string;
    type: IssueType;
    description: string;
    project: { name: string };
    assignee: { id: string; name: string; image: string | null } | null;
  };
  canDecide: boolean;
  canWithdraw: boolean;
}

const STATE_BADGE = {
  pending: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  approved: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  rejected: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200",
  cancelled: "bg-muted text-muted-foreground",
} as const;

function Decision({ request }: { request: ApprovalRow }) {
  const [note, setNote] = useState("");
  const decide = useAction(decideApprovalAction);
  const cancel = useAction(cancelApprovalAction);
  const pending = decide.isPending || cancel.isPending;
  async function run(decision: "approve" | "reject") {
    const res = await decide.executeAsync({ requestId: request.id, decision, note });
    if (res?.serverError) return void toast.error(res.serverError.message);
    toast.success(
      decision === "approve"
        ? `Approved: ${request.key} moved to ${request.to.name}`
        : "Request rejected",
    );
    setNote("");
  }
  if (!request.canDecide && !request.canWithdraw) return null;
  return (
    <div className="space-y-3 rounded-lg border p-4">
      {request.canDecide ? (
        <>
          <Label htmlFor="approval-note">Your decision</Label>
          <Textarea
            id="approval-note"
            rows={3}
            maxLength={500}
            placeholder="Add a note (shown to the requester)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        {request.canWithdraw ? (
          <Button
            variant="ghost"
            disabled={pending}
            onClick={async () => {
              const res = await cancel.executeAsync({ requestId: request.id });
              if (res?.serverError) toast.error(res.serverError.message);
              else toast.success("Request withdrawn");
            }}
          >
            Withdraw request
          </Button>
        ) : null}
        {request.canDecide ? (
          <>
            <Button
              variant="outline"
              className="text-destructive"
              disabled={pending}
              onClick={() => run("reject")}
            >
              <XIcon aria-hidden="true" /> Reject
            </Button>
            <Button disabled={pending} onClick={() => run("approve")}>
              {decide.isPending ? <Spinner /> : <CheckIcon aria-hidden="true" />} Approve
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

/** Approvals: a list of requests and the selected one's details with Approve / Reject. */
export function ApprovalsInbox({
  slug,
  tab,
  requests,
  selectedId,
  waitingCount,
}: {
  slug: string;
  tab: "waiting" | "mine" | "done";
  requests: ApprovalRow[];
  selectedId: string | null;
  waitingCount: number;
}) {
  const selected = requests.find((r) => r.id === selectedId) ?? requests[0] ?? null;
  const base = `/${slug}/approvals`;
  return (
    <div className="space-y-4">
      <Tabs value={tab}>
        <TabsList aria-label="Approvals">
          {(
            [
              ["waiting", `Waiting on me${waitingCount ? ` (${waitingCount})` : ""}`, base],
              ["mine", "Requested by me", `${base}?tab=mine`],
              ["done", "Done", `${base}?tab=done`],
            ] as const
          ).map(([value, title, href]) => (
            <TabsTrigger key={value} value={value} asChild>
              <Link href={href as Route}>{title}</Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {requests.length === 0 ? (
        <EmptyState
          icon={ShieldCheckIcon}
          title={
            tab === "waiting"
              ? "Nothing waits on you"
              : tab === "mine"
                ? "No open requests"
                : "No decisions yet"
          }
          description="Status changes that need sign-off show up here."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <ul className="divide-y overflow-hidden rounded-lg border" aria-label="Requests">
            {requests.map((r) => (
              <li key={r.id}>
                <Link
                  href={
                    `${base}?${new URLSearchParams({ ...(tab !== "waiting" ? { tab } : {}), r: r.id })}` as Route
                  }
                  aria-current={selected?.id === r.id ? "true" : undefined}
                  className={cn(
                    "block space-y-1 px-4 py-3 transition-colors hover:bg-muted/50",
                    selected?.id === r.id && "bg-muted shadow-[inset_2px_0_0_var(--foreground)]",
                  )}
                >
                  <span className="flex items-center gap-2 text-xs">
                    <span className="font-mono text-muted-foreground">{r.key}</span>
                    <Badge
                      variant="secondary"
                      className={cn("h-5 font-normal", STATE_BADGE[r.state])}
                    >
                      {r.state === "pending" ? "Status change" : r.state}
                    </Badge>
                    <TimeAgo
                      date={r.decidedAt ?? r.createdAt}
                      className="ml-auto text-muted-foreground"
                    />
                  </span>
                  <span className="block truncate text-sm font-medium">{r.issue.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {r.requestedBy?.name ?? "Former member"} · {r.from.name} → {r.to.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {selected ? (
            <section aria-label={`${selected.key} approval`} className="min-w-0 space-y-5">
              <div className="space-y-2">
                <span className="flex flex-wrap items-center gap-2 text-sm">
                  <IssueTypeIcon type={selected.issue.type} />
                  <Link
                    href={`/${slug}/issues/${selected.key}` as Route}
                    className="font-mono text-muted-foreground hover:underline"
                  >
                    {selected.key}
                  </Link>
                  <span className="text-muted-foreground">· {selected.issue.project.name}</span>
                </span>
                <h2 className="text-xl font-semibold tracking-tight">{selected.issue.title}</h2>
                <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                  {selected.requestedBy?.name ?? "A former member"} wants to move it from
                  <StatusBadge status={selected.from} /> to <StatusBadge status={selected.to} />
                </p>
              </div>
              <div className="overflow-hidden rounded-lg border">
                <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2 text-sm">
                  <span className="font-medium">Approval rule</span>
                  <span className="text-muted-foreground">
                    {ROLE_LABELS[selected.approverRole]}s and above can decide
                  </span>
                </div>
                <dl className="grid gap-x-6 gap-y-2 px-4 py-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">Requested</dt>
                    <dd className="flex items-center gap-2">
                      {selected.requestedBy ? <UserAvatar user={selected.requestedBy} /> : null}
                      {selected.requestedBy?.name ?? "Former member"} ·{" "}
                      <TimeAgo date={selected.createdAt} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Assignee</dt>
                    <dd className="flex items-center gap-2">
                      {selected.issue.assignee ? (
                        <UserAvatar user={selected.issue.assignee} />
                      ) : null}
                      {selected.issue.assignee?.name ?? "Unassigned"}
                    </dd>
                  </div>
                  {selected.state !== "pending" ? (
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-muted-foreground">Decision</dt>
                      <dd>
                        <span className="capitalize">{selected.state}</span>
                        {selected.decidedBy ? ` by ${selected.decidedBy.name}` : ""}
                        {selected.decidedAt ? (
                          <>
                            {" "}
                            · <TimeAgo date={selected.decidedAt} />
                          </>
                        ) : null}
                        {selected.note ? (
                          <p className="mt-1 text-muted-foreground">“{selected.note}”</p>
                        ) : null}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>
              {selected.issue.description ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Description</h3>
                  <div className="max-h-72 overflow-y-auto rounded-lg border px-4 py-3">
                    <Markdown>{selected.issue.description}</Markdown>
                  </div>
                </div>
              ) : null}
              <Decision key={selected.id} request={selected} />
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
