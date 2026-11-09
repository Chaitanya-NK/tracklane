"use client";

import { BellIcon, BellRingIcon, LinkIcon, Share2Icon, UsersIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { subscribeFilterAction, updateFilterAction } from "../server/actions";
import type { FilterSummary } from "../types";

/** Share menu: copy a link to the search; owners can share the filter with the workspace. */
export function ShareMenu({ slug, filter }: { slug: string; filter: FilterSummary | null }) {
  const update = useAction(updateFilterAction, {
    onSuccess: ({ input }) =>
      toast.success(input.shared ? "Shared with the workspace" : "Only you can see this filter"),
    onError: ({ error }) => toast.error(error.serverError?.message ?? "Couldn't update sharing"),
  });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2Icon aria-hidden="true" /> Share
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem
          onSelect={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
              toast.success("Link copied");
            } catch {
              toast.error("Couldn't copy the link");
            }
          }}
        >
          <LinkIcon aria-hidden="true" /> Copy link
        </DropdownMenuItem>
        {filter?.mine ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={filter.shared}
              disabled={update.isPending}
              onCheckedChange={(shared) =>
                update.execute({
                  slug,
                  filterId: filter.id,
                  name: filter.name,
                  description: filter.description,
                  query: filter.query,
                  shared,
                })
              }
            >
              <UsersIcon aria-hidden="true" /> Shared with workspace
            </DropdownMenuCheckboxItem>
          </>
        ) : null}
        {!filter ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            Save the filter to share it with your workspace.
          </p>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const FREQUENCY_LABEL = { daily: "Daily", weekly: "Weekly" } as const;

/** Subscribe to an emailed digest of a saved filter. */
export function SubscribeMenu({
  slug,
  filter,
  frequency,
}: {
  slug: string;
  filter: FilterSummary | null;
  frequency: "daily" | "weekly" | null;
}) {
  const action = useAction(subscribeFilterAction, {
    onSuccess: ({ data }) =>
      toast.success(
        data
          ? `You'll get a ${data.frequency} email with this filter's results`
          : "Unsubscribed from this filter",
      ),
    onError: ({ error }) => toast.error(error.serverError?.message ?? "Couldn't subscribe"),
  });
  if (!filter)
    return (
      <Button variant="outline" size="sm" disabled title="Save the filter to subscribe to it">
        <BellIcon aria-hidden="true" /> Subscribe
      </Button>
    );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={action.isPending}>
          {frequency ? <BellRingIcon aria-hidden="true" /> : <BellIcon aria-hidden="true" />}
          {frequency ? `${FREQUENCY_LABEL[frequency]} email` : "Subscribe"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Email me the results</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={frequency ?? "off"}
          onValueChange={(value) =>
            action.execute({
              slug,
              filterId: filter.id,
              frequency: value === "off" ? null : (value as "daily" | "weekly"),
            })
          }
        >
          <DropdownMenuRadioItem value="daily">Every day</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="weekly">Every week</DropdownMenuRadioItem>
          <DropdownMenuSeparator />
          <DropdownMenuRadioItem value="off">Don&apos;t email me</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
