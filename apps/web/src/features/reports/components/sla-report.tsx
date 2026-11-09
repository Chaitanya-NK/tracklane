import { formatElapsed } from "@tracklane/core";
import type { Route } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface SlaReportRow {
  policy: { id: string; name: string; metric: string; targetMinutes: number };
  valid: boolean;
  total: number;
  counts: { running: number; at_risk: number; breached: number; met: number; missed: number };
  metRate: number | null;
  attention: { key: string; title: string; remainingMinutes: number; state: string }[];
}

/** Met rate and open risks per SLA over the period. */
export function SlaReport({ slug, rows }: { slug: string; rows: SlaReportRow[] }) {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SLA</TableHead>
              <TableHead className="text-right">Issues</TableHead>
              <TableHead className="text-right">Met</TableHead>
              <TableHead className="text-right">Missed</TableHead>
              <TableHead className="text-right">At risk</TableHead>
              <TableHead className="text-right">Breached</TableHead>
              <TableHead className="text-right">Met rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.policy.id}>
                <TableCell className="font-medium whitespace-normal">
                  {r.policy.name}
                  <div className="text-xs font-normal text-muted-foreground">
                    {r.policy.metric === "resolution" ? "Resolution" : "First response"} within{" "}
                    {formatElapsed(r.policy.targetMinutes)}
                    {r.valid ? "" : " · query no longer valid"}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.total}</TableCell>
                <TableCell className="text-right tabular-nums">{r.counts.met}</TableCell>
                <TableCell className="text-right tabular-nums">{r.counts.missed}</TableCell>
                <TableCell className="text-right tabular-nums">{r.counts.at_risk}</TableCell>
                <TableCell className="text-right tabular-nums">{r.counts.breached}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {r.metRate === null ? "—" : `${r.metRate}%`}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {rows.some((r) => r.attention.length) ? (
        <div className="space-y-1.5">
          <h3 className="text-sm font-medium">Needs attention</h3>
          <ul className="divide-y rounded-lg border text-sm">
            {rows.flatMap((r) =>
              r.attention.map((a) => (
                <li
                  key={`${r.policy.id}:${a.key}`}
                  className="flex flex-wrap items-center gap-2 px-3 py-2"
                >
                  <Link
                    href={`/${slug}/issues/${a.key}` as Route}
                    className="font-mono text-xs text-muted-foreground hover:underline"
                  >
                    {a.key}
                  </Link>
                  <span className="min-w-0 flex-1 truncate">{a.title}</span>
                  <span className="text-xs text-muted-foreground">{r.policy.name}</span>
                  <Badge variant={a.state === "breached" ? "destructive" : "secondary"}>
                    {a.state === "breached"
                      ? `Breached · ${formatElapsed(-a.remainingMinutes)} over`
                      : `At risk · ${formatElapsed(a.remainingMinutes)} left`}
                  </Badge>
                </li>
              )),
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
