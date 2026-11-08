"use client";

import { ExternalLinkIcon } from "lucide-react";
import { useState } from "react";
import { DatePicker } from "@/components/shared/date-picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CustomFieldDef, CustomFieldValue } from "@/features/custom-fields";
import { cn } from "@/lib/utils";
import { AssigneePicker, LabelsPicker } from "./field-pickers";
import { LabelBadge } from "./issue-meta";

export interface CustomFieldInputProps {
  id: string;
  field: CustomFieldDef;
  value: CustomFieldValue | null;
  /** Text-like fields call this on blur/Enter when `variant` is ghost, on every change otherwise. */
  onChange: (value: CustomFieldValue | null) => void;
  users: { id: string; name: string; email: string; image: string | null }[];
  disabled?: boolean;
  /** ghost: inline in the details panel (saves on commit); field: a form control. */
  variant?: "field" | "ghost";
  invalid?: boolean;
}

/** One editor for any custom field type. */
export function CustomFieldInput(props: CustomFieldInputProps) {
  const { id, field, value, onChange, users, disabled, variant = "field", invalid } = props;
  const ghost = variant === "ghost";
  const triggerClass = ghost ? "w-full border-transparent shadow-none" : "w-full";

  switch (field.type) {
    case "text":
    case "url":
    case "number":
      return <TextLikeInput {...props} />;
    case "date":
      return (
        <DatePicker
          id={id}
          variant={ghost ? "ghost" : "field"}
          placeholder="None"
          value={typeof value === "string" ? value : null}
          disabled={disabled}
          onChange={(date) => onChange(date)}
          aria-label={field.name}
        />
      );
    case "checkbox":
      return (
        <div className={cn("flex h-8 items-center", ghost && "px-2")}>
          <Checkbox
            id={id}
            checked={value === true}
            disabled={disabled}
            onCheckedChange={(checked) => onChange(checked === true)}
            aria-label={field.name}
          />
        </div>
      );
    case "select": {
      const selected = Array.isArray(value) ? value[0] : undefined;
      return (
        <Select
          value={selected ?? "none"}
          onValueChange={(v) => onChange(v === "none" ? null : [v])}
          disabled={disabled}
        >
          <SelectTrigger id={id} size="sm" className={triggerClass} aria-invalid={invalid}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              <span className="text-muted-foreground">None</span>
            </SelectItem>
            {field.options.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                <LabelBadge label={{ name: o.value, color: o.color }} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    case "multiselect":
      return (
        <LabelsPicker
          id={id}
          variant={ghost ? "ghost" : "field"}
          label={field.name}
          searchPlaceholder="Search options…"
          emptyText="No options."
          value={Array.isArray(value) ? value : []}
          onChange={(ids) => onChange(ids.length ? ids : null)}
          labels={field.options.map((o) => ({ id: o.id, name: o.value, color: o.color }))}
          disabled={disabled}
        />
      );
    case "user":
      return (
        <AssigneePicker
          id={id}
          variant={ghost ? "ghost" : "field"}
          label={field.name}
          emptyLabel="Nobody"
          value={typeof value === "string" ? value : null}
          onChange={(userId) => onChange(userId)}
          users={users}
          disabled={disabled}
        />
      );
  }
}

function TextLikeInput({
  id,
  field,
  value,
  onChange,
  disabled,
  variant = "field",
  invalid,
}: CustomFieldInputProps) {
  const ghost = variant === "ghost";
  const initial = value === null || value === undefined ? "" : String(value);
  const [draft, setDraft] = useState(initial);
  const toValue = (text: string): CustomFieldValue | null => {
    if (!text.trim()) return null;
    return field.type === "number" ? Number(text) : text;
  };
  const commit = () => {
    if (draft !== initial) onChange(toValue(draft));
  };
  const input = (
    <Input
      id={id}
      type={field.type === "number" ? "number" : field.type === "url" ? "url" : "text"}
      inputMode={field.type === "number" ? "decimal" : undefined}
      placeholder={ghost ? "None" : field.type === "url" ? "https://" : undefined}
      className={cn(ghost && "h-8 border-transparent shadow-none")}
      value={draft}
      disabled={disabled}
      aria-invalid={invalid}
      onChange={(e) => {
        setDraft(e.target.value);
        if (!ghost) onChange(toValue(e.target.value));
      }}
      onBlur={ghost ? commit : undefined}
      onKeyDown={(e) => ghost && e.key === "Enter" && e.currentTarget.blur()}
    />
  );
  if (field.type !== "url" || !initial || !/^https?:\/\//i.test(initial)) return input;
  return (
    <div className="flex items-center gap-1">
      {input}
      <Button variant="ghost" size="icon" className="size-8 shrink-0" asChild>
        <a
          href={initial}
          target="_blank"
          rel="noopener noreferrer nofollow"
          aria-label={`Open ${field.name}`}
        >
          <ExternalLinkIcon />
        </a>
      </Button>
    </div>
  );
}
