"use client";

import {
  ISSUE_TYPE_LABELS,
  ISSUE_TYPES,
  PRIORITIES,
  PRIORITY_LABELS,
  type TqlCatalog,
} from "@tracklane/core";
import { CheckIcon, PlusCircleIcon, SearchIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { type BasicField, type BasicQuery, CURRENT_USER, EMPTY, emptyBasic } from "../basic";

interface Option {
  value: string;
  label: string;
  hint?: string;
}

const LABELS: Record<BasicField, string> = {
  project: "Project",
  type: "Type",
  status: "Status",
  assignee: "Assignee",
  priority: "Priority",
  labels: "Label",
};

function optionsFor(field: BasicField, catalog: TqlCatalog): Option[] {
  switch (field) {
    case "project":
      return catalog.projects.map((p) => ({ value: p.key, label: p.name, hint: p.key }));
    case "type":
      return [
        ...ISSUE_TYPES.map((t) => ({ value: t, label: ISSUE_TYPE_LABELS[t] })),
        ...(catalog.issueTypes ?? []).map((t) => ({ value: t, label: t })),
      ];
    case "status":
      return catalog.statuses.map((s) => ({ value: s, label: s }));
    case "assignee":
      return [
        { value: CURRENT_USER, label: "Me" },
        { value: EMPTY, label: "Unassigned" },
        ...catalog.users.map((u) => ({ value: u.email, label: u.name, hint: u.email })),
      ];
    case "priority":
      return [...PRIORITIES].reverse().map((p) => ({ value: p, label: PRIORITY_LABELS[p] }));
    case "labels":
      return [
        { value: EMPTY, label: "No label" },
        ...catalog.labels.map((l) => ({ value: l, label: l })),
      ];
  }
}

function FieldPill({
  field,
  selected,
  options,
  onChange,
}: {
  field: BasicField;
  selected: string[];
  options: Option[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const has = (v: string) => selected.some((s) => s.toLowerCase() === v.toLowerCase());
  const names = selected.map((v) => options.find((o) => o.value === v)?.label ?? v);
  const toggle = (v: string) =>
    onChange(
      has(v) ? selected.filter((s) => s.toLowerCase() !== v.toLowerCase()) : [...selected, v],
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-8", selected.length === 0 && "border-dashed")}
        >
          <PlusCircleIcon aria-hidden="true" />
          {LABELS[field]}
          {selected.length ? (
            <>
              <Separator orientation="vertical" className="mx-0.5 h-4" />
              {selected.length > 2 ? (
                <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                  {selected.length} selected
                </Badge>
              ) : (
                names.map((n) => (
                  <Badge key={n} variant="secondary" className="rounded-sm px-1 font-normal">
                    {n}
                  </Badge>
                ))
              )}
            </>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={LABELS[field]} />
          <CommandList>
            <CommandEmpty>Nothing found.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={`${o.label} ${o.hint ?? ""}`}
                  onSelect={() => toggle(o.value)}
                >
                  <span
                    className={cn(
                      "flex size-4 items-center justify-center rounded-sm border",
                      has(o.value)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "opacity-60",
                    )}
                  >
                    {has(o.value) ? <CheckIcon className="size-3" aria-hidden="true" /> : null}
                  </span>
                  <span className="truncate">{o.label}</span>
                  {o.hint && o.hint !== o.label ? (
                    <span className="ml-auto truncate text-xs text-muted-foreground">{o.hint}</span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
            {selected.length ? (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={() => onChange([])} className="justify-center">
                    Clear
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Visual query builder: one pill per field plus free text. Changes apply immediately. */
export function BasicBuilder({
  value,
  onChange,
  catalog,
}: {
  value: BasicQuery;
  onChange: (next: BasicQuery) => void;
  catalog: TqlCatalog;
}) {
  const [text, setText] = useState(value.text);
  const fields = Object.keys(LABELS) as BasicField[];
  const anything = fields.some((f) => value.values[f].length) || value.text;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        className="w-full sm:w-64"
        onSubmit={(e) => {
          e.preventDefault();
          onChange({ ...value, text });
        }}
      >
        <InputGroup className="h-8">
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Contains text"
            placeholder="Contains text…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => text !== value.text && onChange({ ...value, text })}
          />
        </InputGroup>
      </form>
      {fields.map((field) => (
        <FieldPill
          key={field}
          field={field}
          selected={value.values[field]}
          options={optionsFor(field, catalog)}
          onChange={(values) =>
            onChange({ ...value, values: { ...value.values, [field]: values } })
          }
        />
      ))}
      {anything ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={() => {
            setText("");
            onChange({
              ...value,
              text: "",
              values: emptyBasic().values,
            });
          }}
        >
          Reset <XIcon aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}
