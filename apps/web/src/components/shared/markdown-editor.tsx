"use client";

import { useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Markdown } from "./markdown";
import { UserAvatar } from "./user-avatar";

export interface MentionUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
  id?: string;
  /** Ctrl/⌘+Enter */
  onSubmit?: () => void;
  /** People offered after typing @. Inserted as @[Name](user:id). */
  mentionUsers?: MentionUser[];
  "aria-label"?: string;
}

/** The "@query" right before the caret, if the caret is in one. */
function mentionAt(text: string, caret: number) {
  const match = /(^|\s)@([\p{L}\d._-]{0,30})$/u.exec(text.slice(0, caret));
  return match ? { start: caret - match[2]!.length - 1, query: match[2]!.toLowerCase() } : null;
}

/** Textarea with Write / Preview tabs. Preview uses the same renderer as display. */
export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  rows = 6,
  autoFocus,
  id,
  onSubmit,
  mentionUsers,
  ...rest
}: MarkdownEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [active, setActive] = useState(0);
  const matches = mention
    ? (mentionUsers ?? [])
        .filter(
          (u) =>
            u.name.toLowerCase().includes(mention.query) ||
            u.email.toLowerCase().startsWith(mention.query),
        )
        .slice(0, 6)
    : [];
  const open = matches.length > 0;
  const listId = id ? `${id}-mentions` : undefined;

  function track(text: string, caret: number) {
    if (!mentionUsers?.length) return;
    const next = mentionAt(text, caret);
    setMention(next);
    if (next?.query !== mention?.query) setActive(0);
  }

  function insert(user: MentionUser) {
    if (!mention) return;
    const caret = ref.current?.selectionStart ?? value.length;
    const token = `@[${user.name.replace(/[[\]]/g, "")}](user:${user.id}) `;
    const next = value.slice(0, mention.start) + token + value.slice(caret);
    onChange(next);
    setMention(null);
    const at = mention.start + token.length;
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(at, at);
    });
  }

  return (
    <Tabs
      defaultValue="write"
      className="gap-0 rounded-md border focus-within:ring-[3px] focus-within:ring-ring/50"
    >
      <div className="flex items-center border-b px-1 py-1">
        <TabsList className="h-7">
          <TabsTrigger value="write" className="px-2 text-xs">
            Write
          </TabsTrigger>
          <TabsTrigger value="preview" className="px-2 text-xs">
            Preview
          </TabsTrigger>
        </TabsList>
        <span className="ml-auto hidden pr-2 text-xs text-muted-foreground sm:inline">
          Markdown supported{mentionUsers?.length ? " · @ to mention" : ""}
        </span>
      </div>
      <TabsContent value="write" className="relative">
        <Textarea
          ref={ref}
          id={id}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            track(e.target.value, e.target.selectionStart);
          }}
          onClick={(e) => track(value, e.currentTarget.selectionStart)}
          onBlur={() => setTimeout(() => setMention(null), 150)}
          placeholder={placeholder}
          rows={rows}
          autoFocus={autoFocus}
          aria-label={rest["aria-label"]}
          role={mentionUsers?.length ? "combobox" : undefined}
          aria-expanded={mentionUsers?.length ? open : undefined}
          aria-controls={open ? listId : undefined}
          aria-autocomplete={mentionUsers?.length ? "list" : undefined}
          aria-activedescendant={open && listId ? `${listId}-${active}` : undefined}
          onKeyDown={(e) => {
            if (open) {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                setActive(
                  (i) => (i + (e.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length,
                );
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                insert(matches[active] ?? matches[0]!);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                setMention(null);
                return;
              }
            }
            if (onSubmit && e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onSubmit();
            }
          }}
          className="resize-y rounded-none border-0 shadow-none focus-visible:ring-0"
        />
        {open ? (
          <ul
            id={listId}
            role="listbox"
            aria-label="Mention someone"
            className="absolute top-full left-2 z-50 mt-1 w-64 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          >
            {matches.map((user, i) => (
              <li
                key={user.id}
                id={listId ? `${listId}-${i}` : undefined}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insert(user);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                  i === active && "bg-accent text-accent-foreground",
                )}
              >
                <UserAvatar user={user} className="size-5" />
                <span className="truncate">{user.name}</span>
                <span className="ml-auto truncate text-xs text-muted-foreground">{user.email}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </TabsContent>
      <TabsContent value="preview" className="min-h-24 px-3 py-2">
        {value.trim() ? (
          <Markdown>{value}</Markdown>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing to preview.</p>
        )}
      </TabsContent>
    </Tabs>
  );
}
