"use client";

import { allowedTargets } from "@tracklane/core";
import { ArrowRightIcon, ChevronDownIcon, FlagIcon, LinkIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { setIssueFlagAction } from "../server/actions";
import type { IssueFormOptions } from "../types";
import { ResolveDialog } from "./resolve-dialog";
import { useIssueUpdate } from "./use-issue-update";

/** Copies the issue's URL. */
export function CopyIssueLink({ path }: { path: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(`${window.location.origin}${path}`);
              toast.success("Link copied");
            } catch {
              toast.error("Couldn't copy the link");
            }
          }}
        >
          <LinkIcon aria-hidden="true" />
          <span className="sr-only">Copy link</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>Copy link</TooltipContent>
    </Tooltip>
  );
}

/** Toggles the impediment flag. */
export function FlagButton({
  issueId,
  flagged,
  canEdit,
}: {
  issueId: string;
  flagged: boolean;
  canEdit: boolean;
}) {
  const action = useAction(setIssueFlagAction, {
    onSuccess: ({ input }) => toast.success(input.flagged ? "Issue flagged" : "Flag removed"),
    onError: ({ error }) => toast.error(error.serverError?.message ?? "Couldn't change the flag"),
  });
  if (!canEdit && !flagged) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("size-8", flagged && "text-red-600 dark:text-red-400")}
          aria-pressed={flagged}
          disabled={!canEdit || action.isPending}
          onClick={() => action.execute({ issueId, flagged: !flagged })}
        >
          <FlagIcon aria-hidden="true" className={flagged ? "fill-current" : undefined} />
          <span className="sr-only">{flagged ? "Remove flag" : "Flag as blocked"}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{flagged ? "Flagged · click to clear" : "Flag as blocked"}</TooltipContent>
    </Tooltip>
  );
}

/**
 * "Move to <next status>" plus a menu of every status the workflow allows from here.
 * Entering a Done status asks for a resolution, as in the details panel.
 */
export function QuickTransition({
  issueId,
  statusId,
  statusCategory,
  options,
}: {
  issueId: string;
  statusId: string;
  statusCategory: string;
  options: IssueFormOptions;
}) {
  const { save, isPending } = useIssueUpdate(issueId);
  const [resolving, setResolving] = useState<{ id: string; name: string } | null>(null);
  if (!options.canEdit) return null;
  const reachable = new Set(
    allowedTargets({
      ...options.transitions,
      fromStatusId: statusId,
      statusIds: options.statuses.map((s) => s.id),
    }),
  );
  const targets = options.statuses.filter((s) => s.id !== statusId && reachable.has(s.id));
  if (targets.length === 0) return null;
  const index = options.statuses.findIndex((s) => s.id === statusId);
  const next = options.statuses.slice(index + 1).find((s) => reachable.has(s.id)) ?? targets[0]!;

  const move = (target: (typeof targets)[number]) => {
    if (target.category === "done" && statusCategory !== "done" && options.resolutions.length) {
      setResolving(target);
      return;
    }
    void save({ statusId: target.id }, `Moved to ${target.name}`);
  };

  return (
    <>
      <ButtonGroup>
        <Button size="sm" variant="outline" disabled={isPending} onClick={() => move(next)}>
          Move to {next.name} <ArrowRightIcon aria-hidden="true" />
        </Button>
        {targets.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="px-2" disabled={isPending}>
                <ChevronDownIcon aria-hidden="true" />
                <span className="sr-only">Other statuses</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Move to</DropdownMenuLabel>
              {targets.map((t) => (
                <DropdownMenuItem key={t.id} onSelect={() => move(t)}>
                  {t.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </ButtonGroup>
      {resolving ? (
        <ResolveDialog
          open
          statusName={resolving.name}
          resolutions={options.resolutions}
          onCancel={() => setResolving(null)}
          onResolve={(resolutionId) => {
            const target = resolving;
            setResolving(null);
            void save({ statusId: target.id, resolutionId }, `Moved to ${target.name}`);
          }}
        />
      ) : null}
    </>
  );
}
