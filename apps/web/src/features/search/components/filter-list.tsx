"use client";

import { MoreHorizontalIcon, StarIcon, UsersIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PRESET_FILTERS } from "../presets";
import { deleteFilterAction, toggleFavoriteAction } from "../server/actions";
import type { FilterSummary } from "../types";
import { SaveFilterDialog } from "./save-filter-dialog";

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      asChild
      variant={active ? "secondary" : "ghost"}
      size="sm"
      className="w-full justify-start font-normal"
    >
      <Link href={href as Route} aria-current={active ? "page" : undefined}>
        {children}
      </Link>
    </Button>
  );
}

function SavedFilterRow({
  slug,
  filter,
  active,
  canAdmin,
}: {
  slug: string;
  filter: FilterSummary;
  active: boolean;
  canAdmin: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const star = useAction(toggleFavoriteAction, {
    onSuccess: ({ data }) =>
      toast.success(data?.starred ? `Starred “${filter.name}”` : `Unstarred “${filter.name}”`),
  });
  const remove = useAction(deleteFilterAction);
  const canManage = filter.mine || (filter.shared && canAdmin);

  return (
    <li className="group flex items-center gap-0.5">
      <div className="min-w-0 flex-1">
        <FilterLink href={`/${slug}/filters?filter=${filter.id}`} active={active}>
          <span className="truncate">{filter.name}</span>
          {filter.shared ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <UsersIcon
                  className="ml-auto size-3.5 shrink-0 text-muted-foreground"
                  aria-label="Shared"
                />
              </TooltipTrigger>
              <TooltipContent>Shared{filter.mine ? "" : ` by ${filter.ownerName}`}</TooltipContent>
            </Tooltip>
          ) : null}
        </FilterLink>
      </div>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={filter.starred ? `Unstar ${filter.name}` : `Star ${filter.name}`}
        aria-pressed={filter.starred}
        disabled={star.isPending}
        onClick={() => star.execute({ slug, filterId: filter.id })}
      >
        <StarIcon
          className={cn(filter.starred && "fill-amber-400 text-amber-500")}
          aria-hidden="true"
        />
      </Button>
      {canManage ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label={`${filter.name} actions`}>
              <MoreHorizontalIcon aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditing(true)}>Edit details</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {editing ? (
        <SaveFilterDialog
          slug={slug}
          query={filter.query}
          filter={filter}
          open
          onOpenChange={setEditing}
        />
      ) : null}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete “${filter.name}”?`}
        description={filter.shared ? "It's shared, so it disappears for everyone." : undefined}
        pending={remove.isPending}
        onConfirm={async () => {
          const res = await remove.executeAsync({ slug, filterId: filter.id });
          if (res?.serverError) return toast.error(res.serverError.message);
          toast.success("Filter deleted");
          setDeleting(false);
        }}
      />
    </li>
  );
}

/** Left column of the Filters page: presets, starred, mine and shared filters. */
export function FilterList({
  slug,
  filters,
  activeId,
  canAdmin,
}: {
  slug: string;
  filters: FilterSummary[];
  activeId: string | null;
  canAdmin: boolean;
}) {
  const starred = filters.filter((f) => f.starred);
  const mine = filters.filter((f) => f.mine && !f.starred);
  const shared = filters.filter((f) => !f.mine && !f.starred);
  const section = (title: string, items: FilterSummary[]) =>
    items.length ? (
      <div className="space-y-1">
        <h3 className="px-2 text-xs font-medium text-muted-foreground">{title}</h3>
        <ul>
          {items.map((f) => (
            <SavedFilterRow
              key={f.id}
              slug={slug}
              filter={f}
              active={activeId === f.id}
              canAdmin={canAdmin}
            />
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <nav aria-label="Filters" className="space-y-4">
      {section("Starred", starred)}
      {section("My filters", mine)}
      {section("Shared with the workspace", shared)}
      {filters.length ? <Separator /> : null}
      <div className="space-y-1">
        <h3 className="px-2 text-xs font-medium text-muted-foreground">Default filters</h3>
        <ul>
          {PRESET_FILTERS.map((preset) => (
            <li key={preset.id}>
              <FilterLink
                href={`/${slug}/filters?preset=${preset.id}`}
                active={activeId === `preset:${preset.id}`}
              >
                {preset.name}
              </FilterLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
