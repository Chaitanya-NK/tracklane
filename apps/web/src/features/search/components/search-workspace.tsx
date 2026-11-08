"use client";

import type { TqlCatalog } from "@tracklane/core";
import { DownloadIcon, SaveIcon, SearchIcon } from "lucide-react";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Spinner } from "@/components/ui/spinner";
import { currentOrder, withOrderBy } from "../sort";
import type { FilterSummary, SearchIssue } from "../types";
import { BulkBar } from "./bulk-bar";
import { ResultsTable } from "./results-table";
import { SaveFilterDialog } from "./save-filter-dialog";
import { TqlEditor, TqlErrorPreview } from "./tql-editor";

export type SearchOutcome =
  | { ok: true; issues: SearchIssue[]; total: number; page: number; pageSize: number }
  | { ok: false; error: { message: string; position?: number; end?: number } };

/** Query editor, results, selection and bulk actions for the Filters page. */
export function SearchWorkspace({
  slug,
  query,
  title,
  filter,
  outcome,
  catalog,
  people,
  canBulkEdit,
  canDelete,
}: {
  slug: string;
  query: string;
  title: string;
  filter: FilterSummary | null;
  outcome: SearchOutcome;
  catalog: TqlCatalog;
  people: { id: string; name: string; image: string | null }[];
  canBulkEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [draft, setDraft] = useState(query);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<"new" | "edit" | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (next: string, page = 1) =>
    startTransition(() => {
      setSelected(new Set());
      const params = new URLSearchParams({ q: next });
      if (filter) params.set("filter", filter.id);
      if (page > 1) params.set("page", String(page));
      router.push(`${pathname}?${params}` as Route);
    });

  const dirty = draft.trim() !== query.trim();
  const order = currentOrder(query);

  return (
    <div className="min-w-0 flex-1 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {filter?.shared && !filter.mine ? (
          <span className="text-sm text-muted-foreground">shared by {filter.ownerName}</span>
        ) : null}
        <ButtonGroup className="ml-auto">
          {filter?.mine ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSaving("edit")}
              disabled={!outcome.ok}
            >
              <SaveIcon aria-hidden="true" /> {dirty ? "Save changes" : "Edit"}
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSaving("new")}
            disabled={!outcome.ok}
          >
            <SaveIcon aria-hidden="true" /> {filter ? "Save as" : "Save filter"}
          </Button>
          <Button asChild variant="outline" size="sm">
            <a
              href={`/api/search/export?${new URLSearchParams({ workspace: slug, q: query })}`}
              download
            >
              <DownloadIcon aria-hidden="true" /> CSV
            </a>
          </Button>
        </ButtonGroup>
      </div>

      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <TqlEditor
            value={draft}
            onChange={setDraft}
            onSubmit={(q) => run(q)}
            catalog={catalog}
            invalid={!outcome.ok}
          />
        </div>
        <Button onClick={() => run(draft)} disabled={pending} className="h-10">
          {pending ? <Spinner /> : <SearchIcon aria-hidden="true" />}
          Search
        </Button>
      </div>

      {!outcome.ok ? (
        <Alert variant="destructive">
          <AlertTitle>The query has an error</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{outcome.error.message}</p>
            <TqlErrorPreview
              query={query}
              position={outcome.error.position}
              end={outcome.error.end}
            />
          </AlertDescription>
        </Alert>
      ) : outcome.issues.length === 0 ? (
        <EmptyState
          icon={SearchIcon}
          title="No issues match"
          description="Try a broader query, e.g. remove a condition."
        />
      ) : (
        <div className={pending ? "opacity-60 transition-opacity" : undefined} aria-busy={pending}>
          <p className="mb-2 text-sm text-muted-foreground">
            {outcome.total} issue{outcome.total === 1 ? "" : "s"}
            {outcome.total > outcome.pageSize
              ? ` · showing ${(outcome.page - 1) * outcome.pageSize + 1}–${Math.min(outcome.page * outcome.pageSize, outcome.total)}`
              : ""}
          </p>
          <ResultsTable
            slug={slug}
            issues={outcome.issues}
            selectable={canBulkEdit}
            selected={selected}
            onSelectedChange={setSelected}
            order={order}
            onSort={(field, direction) => {
              const next = withOrderBy(query, field, direction);
              setDraft(next);
              run(next);
            }}
          />
          {outcome.total > outcome.pageSize ? (
            <Pagination className="mt-4">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    aria-disabled={outcome.page <= 1}
                    className={outcome.page <= 1 ? "pointer-events-none opacity-50" : undefined}
                    onClick={(e) => (e.preventDefault(), run(query, outcome.page - 1))}
                  />
                </PaginationItem>
                <PaginationItem className="px-3 text-sm text-muted-foreground">
                  Page {outcome.page} of {Math.ceil(outcome.total / outcome.pageSize)}
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    aria-disabled={outcome.page * outcome.pageSize >= outcome.total}
                    className={
                      outcome.page * outcome.pageSize >= outcome.total
                        ? "pointer-events-none opacity-50"
                        : undefined
                    }
                    onClick={(e) => (e.preventDefault(), run(query, outcome.page + 1))}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}
        </div>
      )}

      {selected.size > 0 ? (
        <BulkBar
          slug={slug}
          selectedIds={[...selected]}
          onClear={() => setSelected(new Set())}
          statuses={catalog.statuses}
          people={people}
          canDelete={canDelete}
        />
      ) : null}

      {saving ? (
        <SaveFilterDialog
          slug={slug}
          query={draft}
          filter={saving === "edit" ? (filter ?? undefined) : undefined}
          open
          onOpenChange={(open) => !open && setSaving(null)}
        />
      ) : null}
    </div>
  );
}
