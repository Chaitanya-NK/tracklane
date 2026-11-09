"use client";

import {
  highlightTql,
  parseTql,
  suggestTql,
  type TqlCatalog,
  type TqlSpanKind,
  type TqlSuggestion,
} from "@tracklane/core";
import { CircleCheckIcon, CircleXIcon } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { TqlReference } from "./tql-reference";

const KIND_LABEL: Record<TqlSuggestion["kind"], string> = {
  field: "Fields",
  operator: "Operators",
  value: "Values",
  keyword: "Keywords",
  function: "Functions",
};

const SPAN_CLASS: Record<TqlSpanKind, string> = {
  keyword: "font-semibold text-violet-700 dark:text-violet-400",
  field: "text-sky-700 dark:text-sky-400",
  operator: "text-amber-700 dark:text-amber-400",
  string: "text-emerald-700 dark:text-emerald-400",
  function: "text-fuchsia-700 dark:text-fuchsia-400",
  value: "",
  punctuation: "text-muted-foreground",
  space: "",
  error: "text-destructive underline decoration-wavy",
};

/** Shared by the highlight layer and the textarea so their text lines up exactly. */
const TEXT = "px-3 py-2 font-mono text-sm leading-6 whitespace-pre";

/**
 * TQL editor: syntax highlighting, context-aware completion and (optionally) line numbers.
 * ↑/↓ choose a suggestion, Enter/Tab accept it, Escape closes. With the list closed, Enter or
 * ⌘/Ctrl+Enter runs the query and Shift+Enter adds a line.
 */
export function TqlEditor({
  value,
  onChange,
  onSubmit,
  catalog,
  invalid,
  lineNumbers = false,
  minLines = 1,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  catalog: TqlCatalog | null;
  invalid?: boolean;
  lineNumbers?: boolean;
  minLines?: number;
  id?: string;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [cursor, setCursor] = useState(value.length);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const suggestions = useMemo(
    () => (catalog ? suggestTql(value, cursor, catalog) : { from: cursor, to: cursor, items: [] }),
    [value, cursor, catalog],
  );
  const spans = useMemo(() => highlightTql(value), [value]);
  const lineCount = Math.max(minLines, value.split("\n").length);
  const showList = open && suggestions.items.length > 0;

  function accept(item: TqlSuggestion) {
    const needsSpace = !item.insert.endsWith("(");
    const next =
      value.slice(0, suggestions.from) +
      item.insert +
      (needsSpace ? " " : "") +
      value.slice(suggestions.to).replace(/^[ \t]+/, "");
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
        <div
          ref={box}
          data-invalid={invalid || undefined}
          className={cn(
            "flex min-w-0 rounded-md border bg-background shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30",
            invalid &&
              "border-destructive ring-destructive/20 focus-within:border-destructive focus-within:ring-destructive/20",
          )}
        >
          {lineNumbers ? (
            <div
              aria-hidden="true"
              className="shrink-0 border-r bg-muted/40 py-2 pr-2 pl-3 text-right font-mono text-xs leading-6 text-muted-foreground select-none"
            >
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i} className="h-6 text-xs leading-6">
                  {i + 1}
                </div>
              ))}
            </div>
          ) : null}
          <div className="min-w-0 flex-1 overflow-x-auto">
            <div className="grid w-max min-w-full">
              <pre aria-hidden="true" className={cn(TEXT, "pointer-events-none [grid-area:1/1]")}>
                {spans.map((span, i) => (
                  <span key={i} className={SPAN_CLASS[span.kind]}>
                    {span.text}
                  </span>
                ))}
                {/* Keeps the last (possibly empty) line and minLines tall. */}
                {"\n".repeat(Math.max(0, minLines - value.split("\n").length)) + " "}
              </pre>
              <textarea
                ref={input}
                id={id}
                value={value}
                rows={1}
                wrap="off"
                spellCheck={false}
                autoComplete="off"
                autoCapitalize="off"
                role="combobox"
                aria-controls={listId}
                aria-label="TQL query"
                aria-invalid={invalid}
                aria-autocomplete="list"
                aria-expanded={showList}
                placeholder='project = WEB AND status = "In Progress" ORDER BY priority DESC'
                className={cn(
                  TEXT,
                  "resize-none overflow-hidden bg-transparent text-transparent caret-foreground outline-none [grid-area:1/1] selection:bg-primary/20 selection:text-transparent placeholder:text-muted-foreground",
                )}
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
                  const submitChord = e.key === "Enter" && (e.metaKey || e.ctrlKey);
                  if (showList && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                    e.preventDefault();
                    setActive(
                      (i) => (i + (e.key === "ArrowDown" ? 1 : flat.length - 1)) % flat.length,
                    );
                  } else if (
                    showList &&
                    (e.key === "Tab" || (e.key === "Enter" && !submitChord && !e.shiftKey))
                  ) {
                    const item = flat[active];
                    if (item) {
                      e.preventDefault();
                      accept(item);
                    }
                  } else if (e.key === "Escape") {
                    setOpen(false);
                  } else if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    setOpen(false);
                    onSubmit(value);
                  }
                }}
              />
            </div>
          </div>
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) max-w-xl p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (e.target instanceof Node && box.current?.contains(e.target)) e.preventDefault();
        }}
      >
        <Command shouldFilter={false} value={flat[active]?.label ?? ""}>
          <CommandList id={listId} className="max-h-72">
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

/** Live syntax check under the editor: "Valid query" or the first problem and where it is. */
export function TqlValidity({ query, catalog }: { query: string; catalog: TqlCatalog | null }) {
  const result = useMemo(
    () =>
      parseTql(query, {
        customFields: catalog?.customFields,
        issueTypes: catalog?.issueTypes,
        functions: catalog?.functions,
      }),
    [query, catalog],
  );
  if (!query.trim()) return null;
  if (result.ok)
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
        <CircleCheckIcon className="size-3.5" aria-hidden="true" /> Valid query
      </span>
    );
  const before = query.slice(0, result.error.position);
  const line = before.split("\n").length;
  const column = result.error.position - before.lastIndexOf("\n");
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-destructive">
      <CircleXIcon className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">
        {result.error.message} · line {line}, col {column}
      </span>
    </span>
  );
}

/** Keyboard hint shown next to the Run button. */
export function RunShortcut() {
  return (
    <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
      <Kbd>⌘</Kbd>
      <Kbd>↵</Kbd> to run
    </span>
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

/** Opens the TQL reference in a side sheet. */
export function TqlHelpButton() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="link" size="sm" className="h-auto px-0 text-xs">
          Syntax help
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>TQL syntax</SheetTitle>
          <SheetDescription>Fields, operators, functions and examples.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <TqlReference />
        </div>
      </SheetContent>
    </Sheet>
  );
}
