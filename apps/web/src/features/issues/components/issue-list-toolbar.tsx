"use client";

import {
  ISSUE_TYPE_LABELS,
  ISSUE_TYPES,
  PRIORITIES,
  PRIORITY_LABELS,
  type StatusCategory,
} from "@tracklane/core";
import { ArrowDownUpIcon, ChevronDownIcon, SearchIcon, XIcon } from "lucide-react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import {
  hasActiveFilters,
  ISSUE_SORTS,
  type IssueFilters,
  type IssueSort,
  parseIssueFilters,
  serializeIssueFilters,
} from "../filters";
import { IssueTypeIcon, PriorityIcon } from "./issue-meta";

const SORT_LABELS: Record<IssueSort, string> = {
  updated: "Recently updated",
  created: "Recently created",
  priority: "Priority",
  key: "Issue key",
};

function FilterButton({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(count > 0 && "border-primary/50 bg-primary/5")}
        >
          {label}
          {count > 0 ? (
            <Badge className="h-4 min-w-4 rounded-sm px-1 text-[10px] tabular-nums">{count}</Badge>
          ) : null}
          <ChevronDownIcon className="opacity-50" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const toggle = <T,>(list: T[], value: T) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

export function IssueListToolbar({
  statuses,
  assignees,
}: {
  statuses: { id: string; name: string; category: StatusCategory }[];
  assignees: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const filters = parseIssueFilters(Object.fromEntries(searchParams));
  const [q, setQ] = useState(filters.q);

  const apply = (next: Partial<IssueFilters>) =>
    startTransition(() =>
      router.replace(`${pathname}${serializeIssueFilters({ ...filters, ...next })}` as Route, {
        scroll: false,
      }),
    );

  // Debounce typing into the search box.
  useEffect(() => {
    if (q === filters.q) return;
    const timer = setTimeout(() => apply({ q }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to typing
  }, [q]);

  const assigneeLabel =
    filters.assignee === "me"
      ? "Me"
      : filters.assignee === "none"
        ? "Unassigned"
        : assignees.find((a) => a.id === filters.assignee)?.name;

  return (
    <div className="flex flex-wrap items-center gap-2" aria-busy={isPending}>
      <InputGroup className="h-8 w-full sm:w-64">
        <InputGroupAddon>
          <SearchIcon aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search summary or key"
          aria-label="Search issues"
        />
        {q ? (
          <InputGroupAddon align="inline-end">
            <InputGroupButton size="icon-xs" aria-label="Clear search" onClick={() => setQ("")}>
              <XIcon aria-hidden="true" />
            </InputGroupButton>
          </InputGroupAddon>
        ) : null}
      </InputGroup>

      <FilterButton label="Status" count={filters.statusIds.length}>
        {statuses.map((s) => (
          <DropdownMenuCheckboxItem
            key={s.id}
            checked={filters.statusIds.includes(s.id)}
            onCheckedChange={() => apply({ statusIds: toggle(filters.statusIds, s.id) })}
            onSelect={(e) => e.preventDefault()}
          >
            {s.name}
          </DropdownMenuCheckboxItem>
        ))}
      </FilterButton>

      <FilterButton
        label={assigneeLabel ? `Assignee: ${assigneeLabel}` : "Assignee"}
        count={filters.assignee ? 1 : 0}
      >
        <DropdownMenuRadioGroup
          value={filters.assignee ?? ""}
          onValueChange={(v) => apply({ assignee: v || null })}
        >
          <DropdownMenuRadioItem value="">Anyone</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="me">Me</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="none">Unassigned</DropdownMenuRadioItem>
          <DropdownMenuSeparator />
          {assignees.map((a) => (
            <DropdownMenuRadioItem key={a.id} value={a.id}>
              {a.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </FilterButton>

      <FilterButton label="Type" count={filters.types.length}>
        {ISSUE_TYPES.map((t) => (
          <DropdownMenuCheckboxItem
            key={t}
            checked={filters.types.includes(t)}
            onCheckedChange={() => apply({ types: toggle(filters.types, t) })}
            onSelect={(e) => e.preventDefault()}
          >
            <IssueTypeIcon type={t} tooltip={false} /> {ISSUE_TYPE_LABELS[t]}
          </DropdownMenuCheckboxItem>
        ))}
      </FilterButton>

      <FilterButton label="Priority" count={filters.priorities.length}>
        {[...PRIORITIES].reverse().map((p) => (
          <DropdownMenuCheckboxItem
            key={p}
            checked={filters.priorities.includes(p)}
            onCheckedChange={() => apply({ priorities: toggle(filters.priorities, p) })}
            onSelect={(e) => e.preventDefault()}
          >
            <PriorityIcon priority={p} tooltip={false} /> {PRIORITY_LABELS[p]}
          </DropdownMenuCheckboxItem>
        ))}
      </FilterButton>

      {hasActiveFilters(filters) ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("");
            apply({ q: "", statusIds: [], assignee: null, types: [], priorities: [] });
          }}
        >
          <XIcon aria-hidden="true" /> Clear
        </Button>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="ml-auto">
            <ArrowDownUpIcon aria-hidden="true" /> {SORT_LABELS[filters.sort]}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Sort by</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={filters.sort}
            onValueChange={(v) => apply({ sort: v as IssueSort })}
          >
            {ISSUE_SORTS.map((s) => (
              <DropdownMenuRadioItem key={s} value={s}>
                {SORT_LABELS[s]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
