"use client";

import { formatDuration } from "@tracklane/core";
import type { Route } from "next";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { decideTimesheetAction } from "../server/actions";

export interface PendingTimesheet {
  id: string;
  weekStart: string;
  minutes: number;
  user: { id: string; name: string; image: string | null };
}

/** Admins: submitted weeks to approve or send back. */
export function PendingTimesheets({ slug, items }: { slug: string; items: PendingTimesheet[] }) {
  const decide = useAction(decideTimesheetAction, {
    onSuccess: ({ input }) =>
      toast.success(input.decision === "approved" ? "Timesheet approved" : "Timesheet sent back"),
    onError: ({ error }) => toast.error(error.serverError?.message ?? "Couldn't decide"),
  });
  return (
    <section aria-label="Waiting for your approval" className="space-y-3 rounded-xl border p-4">
      <h2 className="text-sm font-semibold">Waiting for your approval</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No submitted timesheets.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((t) => (
            <li key={t.id} className="flex items-center gap-2 text-sm">
              <UserAvatar user={t.user} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{t.user.name}</span>
                <Link
                  href={`/${slug}/teams/timesheets?week=${t.weekStart}&who=all` as Route}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  {formatDuration(t.minutes)} · week of {t.weekStart}
                </Link>
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={decide.isPending}
                onClick={() =>
                  decide.execute({ slug, submissionId: t.id, decision: "rejected", note: "" })
                }
              >
                Reject
              </Button>
              <Button
                size="sm"
                disabled={decide.isPending}
                onClick={() =>
                  decide.execute({ slug, submissionId: t.id, decision: "approved", note: "" })
                }
              >
                Approve
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
