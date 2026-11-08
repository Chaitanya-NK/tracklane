"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Markdown } from "./markdown";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
  id?: string;
  /** Ctrl/⌘+Enter */
  onSubmit?: () => void;
  "aria-label"?: string;
}

/** Textarea with a Write / Preview toggle. Markdown is rendered with the same component as display. */
export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  rows = 6,
  autoFocus,
  id,
  onSubmit,
  ...rest
}: MarkdownEditorProps) {
  const [tab, setTab] = useState<"write" | "preview">("write");
  return (
    <div className="rounded-md border focus-within:ring-[3px] focus-within:ring-ring/50">
      <div className="flex items-center gap-1 border-b px-2 py-1">
        {(["write", "preview"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={cn(
              "rounded px-2 py-1 text-xs font-medium capitalize",
              tab === t
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
        <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
          Markdown supported
        </span>
      </div>
      {tab === "write" ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          autoFocus={autoFocus}
          aria-label={rest["aria-label"]}
          onKeyDown={(e) => {
            if (onSubmit && e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onSubmit();
            }
          }}
          className="resize-y rounded-none border-0 shadow-none focus-visible:ring-0"
        />
      ) : (
        <div className="min-h-24 px-3 py-2">
          {value.trim() ? (
            <Markdown>{value}</Markdown>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing to preview.</p>
          )}
        </div>
      )}
    </div>
  );
}
