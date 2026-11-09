"use client";

import {
  ChevronDownIcon,
  ChevronRightIcon,
  DownloadIcon,
  FilterIcon,
  InboxIcon,
  LayersIcon,
  RotateCcwIcon,
  SaveIcon,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
import { ColumnsPicker } from "@/components/shared/columns-picker";
import { EmptyState } from "@/components/shared/empty-state";
import { TimeAgo } from "@/components/shared/time-ago";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useStoredState } from "@/hooks/use-stored-state";
import { IssueTypeIcon, LabelBadge, PriorityIcon, StatusBadge } from "@/features/issues";
import { BulkBar } from "@/features/search";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  BASE_GROUPS,
  DEFAULT_LIST_COLUMNS,
  LIST_COLUMNS,
  type ListColumn,
  GROUP_LABELS,
  type GroupableField,
  type GroupBy,
  groupRows,
  type ListRow,
} from "../model";
import { saveViewAction } from "../server/actions";
import { RowActions } from "./row-actions";
import { ViewDialog, type ViewSummary } from "./view-dialog";

const PAGE_SIZES = [25, 50, 100] as const;

const sameColumns = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((c, i) => c === b[i]);

function isOverdue(row: ListRow) {
  return Boolean(
    row.dueDate &&
    row.status.category !== "done" &&
    new Date(`${row.dueDate}T23:59:59Z`) < new Date(),
  );
}

/** The project's issue list: views, grouping, columns, selection, bulk edits and paging. */
export function ProjectIssueList({
  slug,
  projectKey,
  userId,
  rows,
  truncated,
  hasFilters,
  statusOrder,
  statusNames,
  people,
  fields,
  activeView,
  params,
  groupBy,
  columns,
  tql,
  canEdit,
  canDelete,
  canSetDefault,
}: {
  slug: string;
  projectKey: string;
  userId: string;
  rows: ListRow[];
  truncated: boolean;
  hasFilters: boolean;
  statusOrder: string[];
  statusNames: string[];
  people: { id: string; name: string; image: string | null }[];
  fields: GroupableField[];
  activeView: ViewSummary | null;
  /** The current filter query string, normalised (no view/group/cols). */
  params: string;
  groupBy: GroupBy;
  columns: ListColumn[];
  tql: string;
  canEdit: boolean;
  canDelete: boolean;
  canSetDefault: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pageSize, setPageSize] = useStoredState<number>("tl.list.pageSize", 50);
  const [page, setPage] = useState(1);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [saveAs, setSaveAs] = useState(false);
  const save = useAction(saveViewAction, {
    onSuccess: () => toast.success("View saved"),
    onError: ({ error }) => toast.error(error.serverError?.message ?? "Couldn't save the view"),
  });

  const state = { params, groupBy, columns };
  const dirty =
    activeView !== null &&
    (activeView.params !== params ||
      activeView.groupBy !== groupBy ||
      !sameColumns(activeView.columns, columns));
  const canSaveView = activeView !== null && (activeView.mine || activeView.editable);

  /** Navigate keeping filters, changing view-level parameters. */
  function setParam(key: "group" | "cols", value: string | null) {
    const next = new URLSearchParams(params);
    if (activeView) next.set("view", activeView.id);
    const keep = { group: groupBy === "none" ? null : groupBy, cols: columns.join(",") };
    const merged = { ...keep, [key]: value };
    if (merged.group) next.set("group", merged.group);
    if (merged.cols !== null) next.set("cols", merged.cols);
    setPage(1);
    router.replace(`${pathname}?${next}` as Route, { scroll: false });
  }

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount);
  const pageRows = rows.slice((current - 1) * pageSize, current * pageSize);
  const groups = useMemo(
    () => groupRows(pageRows, groupBy, { statusOrder }),
    [pageRows, groupBy, statusOrder],
  );
  const show = (c: ListColumn) => columns.includes(c);
  const allOnPage = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));
  const someOnPage = pageRows.some((r) => selected.has(r.id));
  const colSpan = 2 + columns.length + (canEdit ? 1 : 0) + 1;

  const toggle = (ids: string[], on: boolean) => {
    const next = new Set(selected);
    for (const id of ids) {
      if (on) next.add(id);
      else next.delete(id);
    }
    setSelected(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {dirty ? (
          <>
            <Badge
              variant="outline"
              className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
            >
              Unsaved changes
            </Badge>
            <Button asChild variant="ghost" size="sm">
              <Link
                href={
                  `${pathname}?${new URLSearchParams({
                    ...Object.fromEntries(new URLSearchParams(activeView.params)),
                    view: activeView.id,
                    ...(activeView.groupBy !== "none" ? { group: activeView.groupBy } : {}),
                    cols: activeView.columns.join(","),
                  })}` as Route
                }
              >
                <RotateCcwIcon aria-hidden="true" /> Reset
              </Link>
            </Button>
            {canSaveView ? (
              <Button
                size="sm"
                disabled={save.isPending}
                onClick={() =>
                  save.execute({
                    slug,
                    projectKey,
                    viewId: activeView.id,
                    view: { name: activeView.name, params, groupBy, columns },
                  })
                }
              >
                <SaveIcon aria-hidden="true" /> Save view
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => setSaveAs(true)}>
              Save as new
            </Button>
          </>
        ) : null}
        <span className="ml-auto flex flex-wrap items-center gap-2">
          <Select value={groupBy} onValueChange={(v) => setParam("group", v === "none" ? null : v)}>
            <SelectTrigger size="sm" className="w-auto min-w-40" aria-label="Group by">
              <LayersIcon aria-hidden="true" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectGroup>
                <SelectLabel>Group by</SelectLabel>
                {BASE_GROUPS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g === "none" ? GROUP_LABELS[g] : `Group: ${GROUP_LABELS[g]}`}
                  </SelectItem>
                ))}
              </SelectGroup>
              {fields.length ? (
                <>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>Custom fields</SelectLabel>
                    {fields.map((f) => (
                      <SelectItem key={f.id} value={`field:${f.id}`}>
                        Group: {f.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </>
              ) : null}
            </SelectContent>
          </Select>
          <ColumnsPicker
            options={LIST_COLUMNS}
            value={columns}
            onChange={(next) => setParam("cols", next.join(","))}
            defaults={DEFAULT_LIST_COLUMNS}
          />
          <Button asChild variant="outline" size="sm">
            <Link href={`/${slug}/filters?${new URLSearchParams({ q: tql })}` as Route}>
              <FilterIcon aria-hidden="true" /> Save as filter
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a
              href={`/api/search/export?${new URLSearchParams({ workspace: slug, q: tql })}`}
              download
            >
              <DownloadIcon aria-hidden="true" /> Export CSV
            </a>
          </Button>
        </span>
      </div>

      {rows.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={InboxIcon}
            title="No matching issues"
            description="Try removing some filters."
          />
        ) : (
          <EmptyState
            icon={InboxIcon}
            title="No issues yet"
            description="Create the first issue — or press C anywhere."
          />
        )
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                {canEdit ? (
                  <TableHead className="w-10">
                    <Checkbox
                      aria-label="Select all on this page"
                      checked={allOnPage ? true : someOnPage ? "indeterminate" : false}
                      onCheckedChange={(on) =>
                        toggle(
                          pageRows.map((r) => r.id),
                          on === true,
                        )
                      }
                    />
                  </TableHead>
                ) : null}
                <TableHead className="w-28">Key</TableHead>
                <TableHead>Summary</TableHead>
                {show("status") ? <TableHead className="w-36">Status</TableHead> : null}
                {show("assignee") ? <TableHead className="w-40">Assignee</TableHead> : null}
                {show("priority") ? <TableHead className="w-12">P</TableHead> : null}
                {show("type") ? <TableHead className="w-24">Type</TableHead> : null}
                {show("epic") ? <TableHead className="w-44">Epic</TableHead> : null}
                {show("sprint") ? <TableHead className="w-32">Sprint</TableHead> : null}
                {show("labels") ? <TableHead className="w-40">Labels</TableHead> : null}
                {show("points") ? <TableHead className="w-16 text-right">Pts</TableHead> : null}
                {show("due") ? <TableHead className="w-24">Due</TableHead> : null}
                {show("updated") ? <TableHead className="w-28">Updated</TableHead> : null}
                {show("created") ? <TableHead className="w-28">Created</TableHead> : null}
                <TableHead className="w-10">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => {
                const isCollapsed = collapsed.has(group.key);
                return (
                  <Fragment key={group.key}>
                    {groupBy !== "none" ? (
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableCell colSpan={colSpan} className="py-1.5">
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 text-left text-sm font-medium"
                            aria-expanded={!isCollapsed}
                            onClick={() => {
                              const next = new Set(collapsed);
                              if (isCollapsed) next.delete(group.key);
                              else next.add(group.key);
                              setCollapsed(next);
                            }}
                          >
                            {isCollapsed ? (
                              <ChevronRightIcon className="size-4" aria-hidden="true" />
                            ) : (
                              <ChevronDownIcon className="size-4" aria-hidden="true" />
                            )}
                            <span className="truncate">{group.label}</span>
                            <span className="font-normal text-muted-foreground">
                              {group.rows.length} issue{group.rows.length === 1 ? "" : "s"}
                              {group.points ? ` · ${group.points} pts` : ""}
                            </span>
                          </button>
                        </TableCell>
                      </TableRow>
                    ) : null}
                    {isCollapsed
                      ? null
                      : group.rows.map((row) => (
                          <TableRow
                            key={row.id}
                            className="group relative"
                            data-state={selected.has(row.id) ? "selected" : undefined}
                          >
                            {canEdit ? (
                              <TableCell className="relative z-10">
                                <Checkbox
                                  aria-label={`Select ${row.key}`}
                                  checked={selected.has(row.id)}
                                  onCheckedChange={(on) => toggle([row.id], on === true)}
                                />
                              </TableCell>
                            ) : null}
                            <TableCell>
                              <span className="flex items-center gap-2">
                                <IssueTypeIcon type={row.type} custom={row.customType} />
                                <Link
                                  href={`/${slug}/issues/${row.key}` as Route}
                                  className="font-mono text-xs text-muted-foreground group-hover:underline after:absolute after:inset-0"
                                >
                                  {row.key}
                                </Link>
                              </span>
                            </TableCell>
                            <TableCell className="w-full max-w-0 min-w-48">
                              <span
                                className={cn(
                                  "block truncate",
                                  row.status.category === "done"
                                    ? "text-muted-foreground line-through"
                                    : "font-medium",
                                )}
                              >
                                {row.title}
                              </span>
                            </TableCell>
                            {show("status") ? (
                              <TableCell>
                                <StatusBadge status={row.status} />
                              </TableCell>
                            ) : null}
                            {show("assignee") ? (
                              <TableCell>
                                {row.assignee ? (
                                  <span className="flex items-center gap-2 text-sm">
                                    <UserAvatar user={row.assignee} />
                                    <span className="truncate">{row.assignee.name}</span>
                                  </span>
                                ) : (
                                  <span className="text-sm text-muted-foreground">Unassigned</span>
                                )}
                              </TableCell>
                            ) : null}
                            {show("priority") ? (
                              <TableCell>
                                <PriorityIcon priority={row.priority} />
                              </TableCell>
                            ) : null}
                            {show("type") ? (
                              <TableCell className="text-sm capitalize">
                                {row.customType?.name ?? row.type}
                              </TableCell>
                            ) : null}
                            {show("epic") ? (
                              <TableCell className="max-w-44 truncate text-sm text-muted-foreground">
                                {row.epic ? `${row.epic.key} ${row.epic.title}` : "—"}
                              </TableCell>
                            ) : null}
                            {show("sprint") ? (
                              <TableCell className="truncate text-sm text-muted-foreground">
                                {row.sprint?.name ?? "—"}
                              </TableCell>
                            ) : null}
                            {show("labels") ? (
                              <TableCell>
                                <span className="flex gap-1">
                                  {row.labels.slice(0, 3).map((l) => (
                                    <LabelBadge key={l.id} label={l} />
                                  ))}
                                </span>
                              </TableCell>
                            ) : null}
                            {show("points") ? (
                              <TableCell className="text-right text-sm tabular-nums">
                                {row.estimate ?? "—"}
                              </TableCell>
                            ) : null}
                            {show("due") ? (
                              <TableCell
                                className={cn(
                                  "text-sm",
                                  isOverdue(row) ? "text-destructive" : "text-muted-foreground",
                                )}
                              >
                                {row.dueDate
                                  ? formatDate(new Date(`${row.dueDate}T00:00:00Z`), {
                                      day: "numeric",
                                      month: "short",
                                    })
                                  : "—"}
                              </TableCell>
                            ) : null}
                            {show("updated") ? (
                              <TableCell className="text-sm text-muted-foreground">
                                <TimeAgo date={row.updatedAt} />
                              </TableCell>
                            ) : null}
                            {show("created") ? (
                              <TableCell className="text-sm text-muted-foreground">
                                <TimeAgo date={row.createdAt} />
                              </TableCell>
                            ) : null}
                            <TableCell>
                              <RowActions
                                slug={slug}
                                issue={{
                                  id: row.id,
                                  key: row.key,
                                  assigneeId: row.assignee?.id ?? null,
                                }}
                                userId={userId}
                                canEdit={canEdit}
                                canDelete={canDelete}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {rows.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>
            {rows.length} issue{rows.length === 1 ? "" : "s"}
            {truncated ? " (first 500 — narrow the filters to see more)" : ""}
          </span>
          <span className="ml-auto flex items-center gap-2">
            Rows per page
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v));
                setPage(1);
              }}
            >
              <SelectTrigger size="sm" className="w-20" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </span>
          <span>
            Page {current} of {pageCount}
          </span>
          <span className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={current <= 1}
              onClick={() => setPage(current - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={current >= pageCount}
              onClick={() => setPage(current + 1)}
            >
              Next
            </Button>
          </span>
        </div>
      ) : null}

      {selected.size > 0 ? (
        <BulkBar
          slug={slug}
          selectedIds={[...selected]}
          onClear={() => setSelected(new Set())}
          statuses={statusNames}
          people={people}
          canDelete={canDelete}
        />
      ) : null}

      {saveAs ? (
        <ViewDialog
          slug={slug}
          projectKey={projectKey}
          view={null}
          state={state}
          canSetDefault={canSetDefault}
          open
          onOpenChange={(open) => !open && setSaveAs(false)}
        />
      ) : null}
    </div>
  );
}
