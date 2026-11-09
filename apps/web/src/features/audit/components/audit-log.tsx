"use client";

import {
  AUDIT_ACTIONS,
  AUDIT_CATEGORIES,
  auditActionLabel,
  type AuditCategory,
} from "@tracklane/core";
import { DownloadIcon, InfoIcon, ScrollTextIcon } from "lucide-react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useState, useTransition } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { TimeAgo } from "@/components/shared/time-ago";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { loadMoreAuditAction } from "../server/actions";
import type { AuditEventRow } from "../server/queries";

const CATEGORY_LABELS: Record<AuditCategory, string> = {
  workspace: "Workspace",
  members: "Members",
  projects: "Projects",
  security: "Tokens & webhooks",
  integrations: "Integrations",
};

function categoryOf(action: string): AuditCategory | null {
  for (const c of AUDIT_CATEGORIES) if (action in AUDIT_ACTIONS[c]) return c;
  return null;
}

function Details({ event }: { event: AuditEventRow }) {
  const meta = event.metadata as Record<string, unknown> | null;
  const entries = meta ? Object.entries(meta) : [];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7" aria-label="Event details">
          <InfoIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-2 text-xs">
        <p className="font-mono text-muted-foreground">{event.action}</p>
        {entries.length ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            {entries.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-mono break-all">
                  {typeof v === "string" ? v : JSON.stringify(v)}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
        <p className="border-t pt-2 text-muted-foreground">
          IP {event.ipAddress ?? "—"}
          <br />
          <span className="break-all">{event.userAgent ?? "No user agent"}</span>
        </p>
      </PopoverContent>
    </Popover>
  );
}

export function AuditLog({
  slug,
  events: initial,
  nextCursor: initialCursor,
  actors,
}: {
  slug: string;
  events: AuditEventRow[];
  nextCursor: string | null;
  actors: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [extra, setExtra] = useState<{
    events: AuditEventRow[];
    cursor: string | null;
    key: string;
  }>({ events: [], cursor: null, key: "" });
  const key = params.toString();
  // Extra pages belong to the current filters; drop them when filters change.
  const more = extra.key === key ? extra : { events: [], cursor: null, key };
  const events = [...initial, ...more.events];
  const cursor = more.events.length ? more.cursor : initialCursor;
  const load = useAction(loadMoreAuditAction, {
    onSuccess: ({ data }) =>
      data && setExtra({ events: [...more.events, ...data.events], cursor: data.nextCursor, key }),
  });

  function setParam(name: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    start(() => router.replace(`${pathname}?${next.toString()}` as Route, { scroll: false }));
  }

  const exportHref = `/api/audit/export?workspace=${encodeURIComponent(slug)}&${key}`;
  const filtered = ["category", "actor", "q", "from", "to"].some((k) => params.get(k));

  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap items-center gap-2"
        role="search"
        aria-label="Filter audit log"
      >
        <Input
          type="search"
          placeholder="Search actor or target"
          aria-label="Search actor or target"
          className="h-8 w-56"
          defaultValue={params.get("q") ?? ""}
          onKeyDown={(e) => {
            if (e.key === "Enter") setParam("q", e.currentTarget.value.trim() || null);
          }}
          onBlur={(e) => {
            const v = e.currentTarget.value.trim();
            if (v !== (params.get("q") ?? "")) setParam("q", v || null);
          }}
        />
        <Select
          value={params.get("category") ?? "all"}
          onValueChange={(v) => setParam("category", v === "all" ? null : v)}
        >
          <SelectTrigger size="sm" className="w-44" aria-label="Category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All activity</SelectItem>
            {AUDIT_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={params.get("actor") ?? "all"}
          onValueChange={(v) => setParam("actor", v === "all" ? null : v)}
        >
          <SelectTrigger size="sm" className="w-44" aria-label="Actor">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Anyone</SelectItem>
            {actors.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          From
          <Input
            type="date"
            className="h-8 w-36"
            aria-label="From date"
            value={params.get("from") ?? ""}
            onChange={(e) => setParam("from", e.target.value || null)}
          />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          To
          <Input
            type="date"
            className="h-8 w-36"
            aria-label="To date"
            value={params.get("to") ?? ""}
            onChange={(e) => setParam("to", e.target.value || null)}
          />
        </label>
        {filtered ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => start(() => router.replace(pathname as Route, { scroll: false }))}
          >
            Clear
          </Button>
        ) : null}
        {pending ? <Spinner /> : null}
        <Button variant="outline" size="sm" className="ml-auto" asChild>
          <a href={exportHref} download>
            <DownloadIcon aria-hidden="true" />
            Export CSV
          </a>
        </Button>
      </div>

      {events.length ? (
        <div className="rounded-md border">
          <Table aria-label="Audit events">
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>What</TableHead>
                <TableHead>Target</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Details</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e) => {
                const cat = categoryOf(e.action);
                return (
                  <TableRow key={e.id}>
                    <TableCell className="text-muted-foreground">
                      <TimeAgo date={e.createdAt} />
                    </TableCell>
                    <TableCell className="font-medium">{e.actorName}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        {auditActionLabel(e.action)}
                        {cat ? (
                          <Badge variant="outline" className="font-normal">
                            {CATEGORY_LABELS[cat]}
                          </Badge>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-72 truncate" title={e.targetLabel ?? undefined}>
                      {e.targetLabel ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <Details event={e} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          icon={ScrollTextIcon}
          title={filtered ? "No matching events" : "No activity yet"}
          description={
            filtered
              ? "Try a wider date range or clear the filters."
              : "Member, permission, token, webhook and integration changes appear here."
          }
        />
      )}
      {cursor ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            disabled={load.isPending}
            onClick={() =>
              load.execute({ slug, cursor, params: Object.fromEntries(params.entries()) })
            }
          >
            {load.isPending ? <Spinner /> : null}
            Load more
          </Button>
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">Events are kept for one year.</p>
    </div>
  );
}
