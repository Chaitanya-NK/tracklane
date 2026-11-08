"use client";

import { SearchIcon, UserIcon, XIcon } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { type CardFilters, EMPTY_FILTERS, isFiltering } from "../filters";

/** Quick filters shared by the board and the backlog. */
export function CardFiltersBar({
  filters,
  onChange,
  people,
}: {
  filters: CardFilters;
  onChange: (filters: CardFilters) => void;
  people: { id: string; name: string; image: string | null }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <InputGroup className="h-8 w-full sm:w-56">
        <InputGroupAddon>
          <SearchIcon aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          value={filters.q}
          onChange={(e) => onChange({ ...filters, q: e.target.value })}
          placeholder="Search this board"
          aria-label="Search issues"
        />
        {filters.q ? (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              aria-label="Clear search"
              onClick={() => onChange({ ...filters, q: "" })}
            >
              <XIcon aria-hidden="true" />
            </InputGroupButton>
          </InputGroupAddon>
        ) : null}
      </InputGroup>
      {people.length ? (
        <ToggleGroup
          type="multiple"
          value={filters.assignees}
          onValueChange={(assignees) => onChange({ ...filters, assignees })}
          aria-label="Filter by assignee"
          className="gap-0.5"
        >
          {people.map((person) => (
            <Tooltip key={person.id}>
              <TooltipTrigger asChild>
                <ToggleGroupItem
                  value={person.id}
                  aria-label={person.name}
                  className="size-8 rounded-full p-0 data-[state=on]:ring-2 data-[state=on]:ring-primary"
                >
                  <UserAvatar user={person} className="size-7" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>{person.name}</TooltipContent>
            </Tooltip>
          ))}
          <Tooltip>
            <TooltipTrigger asChild>
              <ToggleGroupItem
                value="none"
                aria-label="Unassigned"
                className="size-8 rounded-full p-0 data-[state=on]:ring-2 data-[state=on]:ring-primary"
              >
                <UserIcon aria-hidden="true" />
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent>Unassigned</TooltipContent>
          </Tooltip>
        </ToggleGroup>
      ) : null}
      <Toggle
        variant="outline"
        size="sm"
        pressed={filters.onlyMine}
        onPressedChange={(onlyMine) => onChange({ ...filters, onlyMine })}
      >
        Only my issues
      </Toggle>
      {isFiltering(filters) ? (
        <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_FILTERS)}>
          <XIcon aria-hidden="true" /> Clear filters
        </Button>
      ) : null}
    </div>
  );
}
