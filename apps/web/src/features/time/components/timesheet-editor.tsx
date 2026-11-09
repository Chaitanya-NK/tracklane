"use client";

import { formatDuration } from "@tracklane/core";
import { CopyIcon, PlusIcon, SendIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  copyLastWeekAction,
  setDayTimeAction,
  findIssueAction,
  setWeekBillableAction,
  submitWeekAction,
} from "../server/actions";

export interface SheetRow {
  issue: { id: string; key: string; title: string };
  days: number[];
  total: number;
  billableMinutes: number;
}

const DAY = 86_400_000;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** "1.5", "1h 30m", "90m" → minutes. Empty → 0. Null when unreadable. */
export function parseHours(raw: string): number | null {
  const text = raw.trim().toLowerCase();
  if (!text) return 0;
  if (/^\d+(\.\d+)?$/.test(text)) return Math.round(Number(text) * 60);
  const match = /^(?:(\d+(?:\.\d+)?)h)?\s*(?:(\d+)m)?$/.exec(text);
  if (!match || (!match[1] && !match[2])) return null;
  return Math.round(Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0));
}

const hours = (m: number) => (m ? String(Math.round((m / 60) * 100) / 100) : "");

function Cell({
  issueId,
  date,
  minutes,
  disabled,
  label,
}: {
  issueId: string;
  date: string;
  minutes: number;
  disabled: boolean;
  label: string;
}) {
  const [value, setValue] = useState(hours(minutes));
  const save = useAction(setDayTimeAction, {
    onError: ({ error }) => {
      toast.error(error.serverError?.message ?? "Couldn't save the time");
      setValue(hours(minutes));
    },
  });
  return (
    <Input
      value={value}
      inputMode="decimal"
      aria-label={label}
      disabled={disabled || save.isPending}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      onBlur={() => {
        const next = parseHours(value);
        if (next === null || next > 1440) {
          toast.error("Enter hours like 1.5 or 1h 30m (max 24h)");
          return setValue(hours(minutes));
        }
        if (next !== minutes) save.execute({ issueId, date, minutes: next });
      }}
      className={cn(
        "mx-auto h-8 w-16 text-center font-mono tabular-nums",
        !value && "bg-muted/40 text-muted-foreground",
      )}
    />
  );
}

/** My week: editable hours per issue and day, billable switch, copy last week, submit. */
export function TimesheetEditor({
  slug,
  week,
  rows,
  status,
  reviewNote,
  today,
}: {
  slug: string;
  /** Monday, YYYY-MM-DD. */
  week: string;
  rows: SheetRow[];
  status: "draft" | "submitted" | "approved" | "rejected";
  reviewNote: string | null;
  /** YYYY-MM-DD; later days can't take time. */
  today: string;
}) {
  const [added, setAdded] = useState<SheetRow[]>([]);
  const [issueKey, setIssueKey] = useState("");
  const locked = status === "submitted" || status === "approved";
  const start = new Date(`${week}T00:00:00Z`);
  const days = Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * DAY));
  const all = [...rows, ...added.filter((a) => !rows.some((r) => r.issue.id === a.issue.id))];
  const totals = days.map((_, i) => all.reduce((s, r) => s + (r.days[i] ?? 0), 0));
  const grand = totals.reduce((a, b) => a + b, 0);
  const billable = all.reduce((s, r) => s + r.billableMinutes, 0);

  const copy = useAction(copyLastWeekAction, {
    onSuccess: ({ data }) =>
      toast.success(data?.copied ? `Copied ${data.copied} entries` : "Nothing to copy"),
    onError: ({ error }) => toast.error(error.serverError?.message ?? "Couldn't copy"),
  });
  const submit = useAction(submitWeekAction, {
    onSuccess: () => toast.success("Timesheet sent for approval"),
    onError: ({ error }) => toast.error(error.serverError?.message ?? "Couldn't submit"),
  });
  const bill = useAction(setWeekBillableAction, {
    onError: ({ error }) => toast.error(error.serverError?.message ?? "Couldn't change billing"),
  });
  const find = useAction(findIssueAction);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="secondary"
          className={cn(
            "capitalize",
            status === "approved" &&
              "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
            status === "submitted" &&
              "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
            status === "rejected" && "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
          )}
        >
          {status}
        </Badge>
        {status === "rejected" && reviewNote ? (
          <span className="text-sm text-muted-foreground">“{reviewNote}”</span>
        ) : null}
        <span className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={locked || copy.isPending}
            onClick={() => copy.execute({ slug, week })}
          >
            <CopyIcon aria-hidden="true" /> Copy last week
          </Button>
          <Button
            size="sm"
            disabled={locked || submit.isPending || grand === 0}
            onClick={() => submit.execute({ slug, week })}
          >
            <SendIcon aria-hidden="true" />{" "}
            {status === "rejected" ? "Resubmit" : "Submit for approval"}
          </Button>
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[56rem] text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Issue</th>
              {days.map((d, i) => (
                <th
                  key={i}
                  className={cn("px-1 py-2 font-medium", i >= 5 && "text-muted-foreground/60")}
                >
                  {WEEKDAYS[i]}
                  <br />
                  <span className="text-foreground">{d.getUTCDate()}</span>
                </th>
              ))}
              <th className="px-2 py-2 font-medium">Billable</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {all.map((row) => (
              <tr key={row.issue.id} className="border-t">
                <td className="max-w-72 px-4 py-1.5">
                  <Link
                    href={`/${slug}/issues/${row.issue.key}` as Route}
                    className="block hover:underline"
                  >
                    <span className="block font-mono text-xs text-muted-foreground">
                      {row.issue.key}
                    </span>
                    <span className="block truncate font-medium">{row.issue.title}</span>
                  </Link>
                </td>
                {days.map((d, i) => (
                  <td key={i} className="px-1 py-1.5 text-center">
                    <Cell
                      issueId={row.issue.id}
                      date={iso(d)}
                      minutes={row.days[i] ?? 0}
                      disabled={locked || iso(d) > today}
                      label={`${row.issue.key} ${WEEKDAYS[i]}`}
                    />
                  </td>
                ))}
                <td className="px-2 py-1.5 text-center">
                  <Switch
                    aria-label={`${row.issue.key} billable`}
                    checked={row.total === 0 || row.billableMinutes === row.total}
                    disabled={locked || row.total === 0}
                    onCheckedChange={(on) =>
                      bill.execute({ slug, issueId: row.issue.id, week, billable: on })
                    }
                  />
                </td>
                <td className="px-4 py-1.5 text-right font-mono font-semibold tabular-nums">
                  {row.total ? formatDuration(row.total) : "—"}
                </td>
              </tr>
            ))}
            {!locked ? (
              <tr className="border-t">
                <td className="px-4 py-2" colSpan={10}>
                  <form
                    className="flex items-center gap-2"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const key = issueKey.trim().toUpperCase();
                      if (!key) return;
                      const res = await find.executeAsync({ slug, issueKey: key });
                      if (!res?.data) return void toast.error(`Couldn't find ${key}`);
                      const issue = res.data;
                      setAdded((a) => [
                        ...a,
                        { issue, days: [0, 0, 0, 0, 0, 0, 0], total: 0, billableMinutes: 0 },
                      ]);
                      setIssueKey("");
                    }}
                  >
                    <Input
                      value={issueKey}
                      onChange={(e) => setIssueKey(e.target.value)}
                      placeholder="Issue key, e.g. WEB-12"
                      aria-label="Add an issue to the timesheet"
                      className="h-8 w-56"
                    />
                    <Button type="submit" variant="outline" size="sm" className="border-dashed">
                      <PlusIcon aria-hidden="true" /> Add issue
                    </Button>
                  </form>
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot className="border-t bg-muted/40 font-semibold">
            <tr>
              <td className="px-4 py-2">Daily total</td>
              {totals.map((m, i) => (
                <td
                  key={i}
                  className={cn(
                    "px-1 py-2 text-center font-mono tabular-nums",
                    m > 480 && "text-destructive",
                  )}
                >
                  {m ? formatDuration(m) : "–"}
                </td>
              ))}
              <td />
              <td className="px-4 py-2 text-right font-mono tabular-nums">
                {formatDuration(grand) || "0m"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Enter hours like <span className="font-mono">1.5</span> or{" "}
        <span className="font-mono">1h 30m</span>. Billable {formatDuration(billable) || "0m"} ·
        internal {formatDuration(grand - billable) || "0m"}.
      </p>
    </div>
  );
}
