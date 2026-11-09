"use client";

import {
  MoreHorizontalIcon,
  PinIcon,
  PlusIcon,
  Settings2Icon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { deleteViewAction } from "../server/actions";
import { ViewDialog, type ViewSummary } from "./view-dialog";

export function viewHref(pathname: string, view: ViewSummary): string {
  const params = new URLSearchParams(view.params);
  params.set("view", view.id);
  if (view.groupBy !== "none") params.set("group", view.groupBy);
  if (view.columns.length) params.set("cols", view.columns.join(","));
  return `${pathname}?${params}`;
}

/** Tabs across the top of the project list: "All issues" plus saved views. */
export function ViewTabs({
  slug,
  projectKey,
  views,
  activeId,
  state,
  canSetDefault,
  isAdmin,
}: {
  slug: string;
  projectKey: string;
  views: ViewSummary[];
  activeId: string | null;
  state: { params: string; groupBy: string; columns: string[] };
  canSetDefault: boolean;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [dialog, setDialog] = useState<ViewSummary | "new" | null>(null);
  const [deleting, setDeleting] = useState<ViewSummary | null>(null);
  const remove = useAction(deleteViewAction, {
    onSuccess: () => {
      toast.success("View deleted");
      setDeleting(null);
      router.push(pathname as Route);
    },
    onError: ({ error }) => toast.error(error.serverError?.message ?? "Couldn't delete the view"),
  });

  const tab = (active: boolean) =>
    cn(
      "inline-flex h-9 items-center gap-1.5 border-b-2 px-1 text-sm font-medium whitespace-nowrap transition-colors",
      active
        ? "border-foreground text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground",
    );

  return (
    <div
      className="flex items-center gap-4 overflow-x-auto border-b"
      role="tablist"
      aria-label="Views"
    >
      <Link
        href={`${pathname}?view=all` as Route}
        role="tab"
        aria-selected={activeId === null}
        className={tab(activeId === null)}
      >
        All issues
      </Link>
      {views.map((view) => (
        <span key={view.id} className="group/tab inline-flex items-center">
          <Link
            href={viewHref(pathname, view) as Route}
            role="tab"
            aria-selected={activeId === view.id}
            className={tab(activeId === view.id)}
          >
            {view.isDefault ? <PinIcon className="size-3.5" aria-label="Team default" /> : null}
            {view.name}
            {view.shared && !view.isDefault ? (
              <UsersIcon className="size-3.5 text-muted-foreground" aria-label="Shared" />
            ) : null}
          </Link>
          {view.mine || isAdmin ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 opacity-60 group-hover/tab:opacity-100"
                >
                  <MoreHorizontalIcon aria-hidden="true" />
                  <span className="sr-only">Options for {view.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onSelect={() => setDialog(view)}>
                  <Settings2Icon aria-hidden="true" /> Rename and share…
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(view)}>
                  <Trash2Icon aria-hidden="true" /> Delete view
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </span>
      ))}
      <Button variant="ghost" size="sm" className="h-8 shrink-0" onClick={() => setDialog("new")}>
        <PlusIcon aria-hidden="true" /> New view
      </Button>

      {dialog ? (
        <ViewDialog
          slug={slug}
          projectKey={projectKey}
          view={dialog === "new" ? null : dialog}
          state={state}
          canSetDefault={canSetDefault}
          open
          onOpenChange={(open) => !open && setDialog(null)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete "${deleting?.name}"?`}
        description={
          deleting?.shared ? "The tab disappears for everyone in the project." : undefined
        }
        pending={remove.isPending}
        onConfirm={() => deleting && remove.execute({ slug, projectKey, viewId: deleting.id })}
      />
    </div>
  );
}
