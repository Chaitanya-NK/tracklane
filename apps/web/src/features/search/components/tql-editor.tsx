"use client";

import { suggestTql, type TqlCatalog, type TqlSuggestion } from "@tracklane/core";
import { SearchIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

const KIND_LABEL: Record<TqlSuggestion["kind"], string> = {
  field: "Fields",
  operator: "Operators",
  value: "Values",
  keyword: "Keywords",
  function: "Functions",
};

/**
 * Single-line TQL input with context-aware completion. ↑/↓ choose, Enter/Tab accept, Escape
 * closes; Enter with the list closed runs the query.
 */
export function TqlEditor({
  value,
  onChange,
  onSubmit,
  catalog,
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  catalog: TqlCatalog | null;
  invalid?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [cursor, setCursor] = useState(value.length);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const suggestions = useMemo(
    () => (catalog ? suggestTql(value, cursor, catalog) : { from: cursor, to: cursor, items: [] }),
    [value, cursor, catalog],
  );
  const showList = open && suggestions.items.length > 0;

  function accept(item: TqlSuggestion) {
    const needsSpace = !item.insert.endsWith("(");
    const next =
      value.slice(0, suggestions.from) +
      item.insert +
      (needsSpace ? " " : "") +
      value.slice(suggestions.to).trimStart();
    const position = suggestions.from + item.insert.length + (needsSpace ? 1 : 0);
    onChange(next);
    setCursor(position);
    setActive(0);
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(position, position);
    });
  }

  const grouped = suggestions.items.reduce<Record<string, TqlSuggestion[]>>((acc, item) => {
    (acc[item.kind] ??= []).push(item);
    return acc;
  }, {});
  const flat = Object.values(grouped).flat();

  return (
    <Popover open={showList} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <InputGroup className="h-10" data-invalid={invalid || undefined}>
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            ref={input}
            value={value}
            spellCheck={false}
            autoComplete="off"
            aria-label="TQL query"
            aria-invalid={invalid}
            aria-autocomplete="list"
            aria-expanded={showList}
            placeholder='project = WEB AND status = "In Progress" ORDER BY priority DESC'
            className="font-mono text-sm"
            onChange={(e) => {
              onChange(e.target.value);
              setCursor(e.target.selectionStart ?? e.target.value.length);
              setActive(0);
              setOpen(true);
            }}
            onSelect={(e) => setCursor(e.currentTarget.selectionStart ?? 0)}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onKeyDown={(e) => {
              if (showList && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                e.preventDefault();
                setActive((i) => (i + (e.key === "ArrowDown" ? 1 : flat.length - 1)) % flat.length);
              } else if (
                showList &&
                (e.key === "Tab" || (e.key === "Enter" && !e.metaKey && !e.ctrlKey))
              ) {
                const item = flat[active];
                if (item) {
                  e.preventDefault();
                  accept(item);
                }
              } else if (e.key === "Escape") {
                setOpen(false);
              } else if (e.key === "Enter") {
                e.preventDefault();
                setOpen(false);
                onSubmit(value);
              }
            }}
          />
          <InputGroupAddon align="inline-end">
            <Kbd className="hidden sm:inline-flex">↵</Kbd>
          </InputGroupAddon>
        </InputGroup>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) max-w-xl p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (e.target instanceof Node && input.current?.parentElement?.contains(e.target))
            e.preventDefault();
        }}
      >
        <Command shouldFilter={false} value={flat[active]?.label ?? ""}>
          <CommandList className="max-h-72">
            {Object.entries(grouped).map(([kind, items]) => (
              <CommandGroup key={kind} heading={KIND_LABEL[kind as TqlSuggestion["kind"]]}>
                {items.map((item) => (
                  <CommandItem
                    key={`${kind}:${item.label}`}
                    value={item.label}
                    onMouseDown={(e) => e.preventDefault()}
                    onSelect={() => accept(item)}
                  >
                    <span className="font-mono text-xs">{item.label}</span>
                    {item.detail ? (
                      <span className="ml-auto truncate text-xs text-muted-foreground">
                        {item.detail}
                      </span>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** The query with the error span underlined, under the editor. */
export function TqlErrorPreview({
  query,
  position,
  end,
}: {
  query: string;
  position?: number;
  end?: number;
}) {
  if (position === undefined) return null;
  const to = Math.max(end ?? position + 1, position + 1);
  return (
    <pre className="overflow-x-auto rounded-md bg-muted/50 px-3 py-2 font-mono text-xs whitespace-pre-wrap">
      {query.slice(0, position)}
      <mark className="bg-transparent text-destructive underline decoration-destructive decoration-wavy underline-offset-4">
        {query.slice(position, to) || " "}
      </mark>
      {query.slice(to)}
    </pre>
  );
}

export function TqlHelpButton() {
  return (
    <Button asChild variant="link" size="sm" className="px-0">
      <a href="#tql-help">Syntax help</a>
    </Button>
  );
}
