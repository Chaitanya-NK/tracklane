"use client";

import { Columns3Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** "Columns" menu: tick which optional table columns to show. */
export function ColumnsPicker<T extends string>({
  options,
  value,
  onChange,
  defaults,
}: {
  options: readonly { id: T; label: string }[];
  value: readonly T[];
  onChange: (next: T[]) => void;
  defaults?: readonly T[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Columns3Icon aria-hidden="true" /> Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Show columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((o) => (
          <DropdownMenuCheckboxItem
            key={o.id}
            checked={value.includes(o.id)}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={(checked) =>
              onChange(
                checked
                  ? options.map((x) => x.id).filter((id) => id === o.id || value.includes(id))
                  : value.filter((id) => id !== o.id),
              )
            }
          >
            {o.label}
          </DropdownMenuCheckboxItem>
        ))}
        {defaults ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onChange([...defaults])}>
              Reset to default
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
