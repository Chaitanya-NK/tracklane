"use client";

import {
  BoldIcon,
  CodeIcon,
  Heading2Icon,
  ItalicIcon,
  LinkIcon,
  ListChecksIcon,
  ListIcon,
  QuoteIcon,
  type LucideIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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

/** "/" commands: typed at the start of a line, replaced by a snippet. */
const SLASH_COMMANDS: { id: string; label: string; hint: string; snippet: string }[] = [
  { id: "h2", label: "Heading", hint: "## ", snippet: "## " },
  { id: "h3", label: "Subheading", hint: "### ", snippet: "### " },
  { id: "todo", label: "Checklist", hint: "- [ ] ", snippet: "- [ ] " },
  { id: "list", label: "Bulleted list", hint: "- ", snippet: "- " },
  { id: "numbered", label: "Numbered list", hint: "1. ", snippet: "1. " },
  { id: "quote", label: "Quote", hint: "> ", snippet: "> " },
  { id: "code", label: "Code block", hint: "```", snippet: "```\n\n```" },
  {
    id: "table",
    label: "Table",
    hint: "| a | b |",
    snippet: "| Column | Column |\n| --- | --- |\n|  |  |",
  },
  {
    id: "mermaid",
    label: "Diagram (Mermaid)",
    hint: "```mermaid",
    snippet: "```mermaid\nflowchart LR\n  A --> B\n```",
  },
  { id: "divider", label: "Divider", hint: "---", snippet: "---\n" },
];

/** The "/query" at the start of the caret's line, if any. */
function slashAt(text: string, caret: number) {
  const match = /(^|\n)\/([a-z0-9]{0,15})$/i.exec(text.slice(0, caret));
  return match ? { start: caret - match[2]!.length - 1, query: match[2]!.toLowerCase() } : null;
}

type ToolbarAction =
  | { kind: "wrap"; before: string; after: string; placeholder: string }
  | { kind: "line"; prefix: string };

const TOOLBAR: { label: string; icon: LucideIcon; action: ToolbarAction }[] = [
  {
    label: "Bold",
    icon: BoldIcon,
    action: { kind: "wrap", before: "**", after: "**", placeholder: "bold" },
  },
  {
    label: "Italic",
    icon: ItalicIcon,
    action: { kind: "wrap", before: "_", after: "_", placeholder: "italic" },
  },
  { label: "Heading", icon: Heading2Icon, action: { kind: "line", prefix: "## " } },
  {
    label: "Code",
    icon: CodeIcon,
    action: { kind: "wrap", before: "`", after: "`", placeholder: "code" },
  },
  {
    label: "Insert link",
    icon: LinkIcon,
    action: { kind: "wrap", before: "[", after: "](https://)", placeholder: "text" },
  },
  { label: "Bulleted list", icon: ListIcon, action: { kind: "line", prefix: "- " } },
  { label: "Checklist", icon: ListChecksIcon, action: { kind: "line", prefix: "- [ ] " } },
  { label: "Quote", icon: QuoteIcon, action: { kind: "line", prefix: "> " } },
];

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
  const [slash, setSlash] = useState<{ start: number; query: string } | null>(null);
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
  const commands = slash
    ? SLASH_COMMANDS.filter(
        (c) => c.id.startsWith(slash.query) || c.label.toLowerCase().includes(slash.query),
      )
    : [];
  const open = matches.length > 0 || commands.length > 0;
  const count = matches.length || commands.length;
  const listId = id ? `${id}-suggestions` : undefined;

  function track(text: string, caret: number) {
    const nextSlash = slashAt(text, caret);
    setSlash(nextSlash);
    const next = mentionUsers?.length ? mentionAt(text, caret) : null;
    setMention(next);
    if (next?.query !== mention?.query || nextSlash?.query !== slash?.query) setActive(0);
  }

  function placeCaret(at: number, end = at) {
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(at, end);
    });
  }

  function runCommand(command: (typeof SLASH_COMMANDS)[number]) {
    if (!slash) return;
    const caret = ref.current?.selectionStart ?? value.length;
    const snippet = command.snippet;
    onChange(value.slice(0, slash.start) + snippet + value.slice(caret));
    setSlash(null);
    // Code blocks: put the caret on the empty middle line.
    const inner = snippet.indexOf("\n\n");
    placeCaret(slash.start + (inner >= 0 ? inner + 1 : snippet.length));
  }

  function applyToolbar(action: ToolbarAction) {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    if (action.kind === "wrap") {
      const selected = value.slice(start, end) || action.placeholder;
      onChange(value.slice(0, start) + action.before + selected + action.after + value.slice(end));
      const from = start + action.before.length;
      placeCaret(from, from + selected.length);
    } else {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const block = value.slice(lineStart, end);
      const prefixed = block
        .split("\n")
        .map((line) => action.prefix + line)
        .join("\n");
      onChange(value.slice(0, lineStart) + prefixed + value.slice(end));
      placeCaret(end + (prefixed.length - block.length));
    }
  }

  function insert(user: MentionUser) {
    if (!mention) return;
    const caret = ref.current?.selectionStart ?? value.length;
    const token = `@[${user.name.replace(/[[\]]/g, "")}](user:${user.id}) `;
    const next = value.slice(0, mention.start) + token + value.slice(caret);
    onChange(next);
    setMention(null);
    placeCaret(mention.start + token.length);
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
        <div className="ml-2 flex items-center" role="toolbar" aria-label="Formatting">
          {TOOLBAR.map((t) => (
            <Button
              key={t.label}
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground"
              title={t.label}
              aria-label={t.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyToolbar(t.action)}
            >
              <t.icon aria-hidden="true" />
            </Button>
          ))}
        </div>
        <span className="ml-auto hidden pr-2 text-xs text-muted-foreground lg:inline">
          / for blocks{mentionUsers?.length ? " · @ to mention" : ""}
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
          onBlur={() =>
            setTimeout(() => {
              setMention(null);
              setSlash(null);
            }, 150)
          }
          placeholder={placeholder}
          rows={rows}
          autoFocus={autoFocus}
          aria-label={rest["aria-label"]}
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={open && listId ? `${listId}-${active}` : undefined}
          onKeyDown={(e) => {
            if (open) {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => (i + (e.key === "ArrowDown" ? 1 : count - 1)) % count);
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                if (matches.length) insert(matches[active] ?? matches[0]!);
                else runCommand(commands[active] ?? commands[0]!);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                setMention(null);
                setSlash(null);
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
        {commands.length && !matches.length ? (
          <ul
            id={listId}
            role="listbox"
            aria-label="Insert a block"
            className="absolute top-full left-2 z-50 mt-1 w-64 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          >
            {commands.map((command, i) => (
              <li
                key={command.id}
                id={listId ? `${listId}-${i}` : undefined}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  runCommand(command);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                  i === active && "bg-accent text-accent-foreground",
                )}
              >
                <span>{command.label}</span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">
                  {command.hint}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {matches.length ? (
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
