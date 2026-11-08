"use client";

import { format } from "date-fns";
import { CalendarIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** "2026-12-31" → a local Date for that calendar day (no timezone shift). */
export function parseDateValue(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : undefined;
}

/** A local Date → "2026-12-31". */
export function toDateValue(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

interface DatePickerProps {
  /** Calendar date as YYYY-MM-DD, or null. */
  value: string | null;
  onChange: (value: string | null) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  /** "field" looks like an input; "ghost" blends into detail panels. */
  variant?: "field" | "ghost";
  "aria-label"?: string;
  /** Highlight the value as overdue. */
  danger?: boolean;
}

/** shadcn date picker: a Button opening a Calendar in a Popover, with a clear action. */
export function DatePicker({
  value,
  onChange,
  id,
  placeholder = "Pick a date",
  disabled,
  variant = "field",
  danger,
  ...rest
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseDateValue(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button
          id={id}
          type="button"
          variant={variant === "field" ? "outline" : "ghost"}
          aria-label={rest["aria-label"]}
          className={cn(
            "justify-start font-normal",
            variant === "field" ? "w-full" : "h-8 w-full px-2",
            !selected && "text-muted-foreground",
            danger && "text-destructive",
          )}
        >
          <CalendarIcon aria-hidden="true" />
          {selected ? format(selected, "d MMM yyyy") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          captionLayout="dropdown"
          onSelect={(date) => {
            onChange(date ? toDateValue(date) : null);
            setOpen(false);
          }}
        />
        {selected ? (
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              <XIcon aria-hidden="true" /> Clear date
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
