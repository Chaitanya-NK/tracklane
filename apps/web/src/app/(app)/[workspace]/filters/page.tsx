import { can, formatIssueKey } from "@tracklane/core";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { listAssignableUsers } from "@/features/projects/server";
import { FilterList, PRESET_FILTERS, SearchWorkspace, type FilterSummary } from "@/features/search";
import {
  getFilter,
  getSubscription,
  getTqlCatalog,
  listFilters,
  PAGE_SIZE,
  searchIssues,
} from "@/features/search/server";
import { getWorkspaceAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Filters" };

type Props = PageProps<"/[workspace]/filters">;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function toSummary(f: Awaited<ReturnType<typeof listFilters>>[number]): FilterSummary {
  return {
    id: f.id,
    name: f.name,
    description: f.description,
    query: f.query,
    shared: f.shared,
    starred: f.starred,
    mine: f.mine,
    ownerName: f.owner.name,
  };
}

async function Filters({ params, searchParams }: Props) {
  const [{ workspace: slug }, sp] = await Promise.all([params, searchParams]);
  const { workspace, user, role } = await getWorkspaceAccess(slug);
  const filterId = first(sp.filter);
  const presetId = first(sp.preset);
  const page = Math.max(1, Number(first(sp.page)) || 1);

  const [filters, saved, catalog, people] = await Promise.all([
    listFilters(workspace.id, user.id),
    filterId ? getFilter(workspace.id, user.id, filterId) : Promise.resolve(null),
    getTqlCatalog(workspace.id, user.id),
    listAssignableUsers(workspace.id),
  ]);
  const summaries = filters.map(toSummary);
  const active = saved ? (summaries.find((f) => f.id === saved.id) ?? null) : null;
  const preset =
    PRESET_FILTERS.find((p) => p.id === presetId) ??
    (!filterId && first(sp.q) === undefined ? PRESET_FILTERS[0] : undefined);
  const query = first(sp.q) ?? saved?.query ?? preset?.query ?? "";
  const title = active?.name ?? (first(sp.q) === undefined ? preset?.name : undefined) ?? "Search";

  const [result, subscription] = await Promise.all([
    searchIssues({ workspaceId: workspace.id, userId: user.id, query, page }),
    saved ? getSubscription(saved.id, user.id) : Promise.resolve(null),
  ]);
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <aside className="lg:w-60 lg:shrink-0">
        <FilterList
          slug={slug}
          filters={summaries}
          activeId={
            active?.id ?? (preset && first(sp.q) === undefined ? `preset:${preset.id}` : null)
          }
          canAdmin={can(role, "workspace:update")}
        />
      </aside>
      <SearchWorkspace
        key={`${filterId ?? ""}:${presetId ?? ""}:${query}`}
        slug={slug}
        query={query}
        title={title}
        filter={active}
        catalog={catalog}
        people={people}
        canBulkEdit={can(role, "issues:update")}
        canDelete={can(role, "issues:delete")}
        subscription={subscription?.frequency ?? null}
        outcome={
          result.ok
            ? {
                ok: true,
                total: result.total,
                durationMs: result.durationMs,
                page,
                pageSize: PAGE_SIZE,
                issues: result.issues.map((issue) => ({
                  id: issue.id,
                  key: formatIssueKey(issue.project.key, issue.number),
                  title: issue.title,
                  type: issue.type,
                  priority: issue.priority,
                  status: { name: issue.status.name, category: issue.status.category },
                  project: issue.project,
                  assignee: issue.assignee,
                  labels: issue.labels.map((l) => l.label),
                  estimate: issue.estimate,
                  dueDate: issue.dueDate ? issue.dueDate.toISOString().slice(0, 10) : null,
                  updatedAt: issue.updatedAt.toISOString(),
                })),
              }
            : { ok: false, error: result.error }
        }
      />
    </div>
  );
}

function FiltersSkeleton() {
  return (
    <div className="flex gap-6" aria-busy="true">
      <Skeleton className="hidden h-80 w-60 lg:block" />
      <div className="flex-1 space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  );
}

export default function FiltersPage({ params, searchParams }: Props) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Filters"
        description="Search every project with TQL, save the searches you use, and change many issues at once."
      />
      <Suspense fallback={<FiltersSkeleton />}>
        <Filters params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
