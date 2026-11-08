"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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

/** Textarea with Write / Preview tabs. Preview uses the same renderer as display. */
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
          Markdown supported
        </span>
      </div>
      <TabsContent value="write">
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
