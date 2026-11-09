"use client";

import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function SprintPicker({
  value,
  sprints,
}: {
  value: string;
  sprints: { id: string; name: string; state: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <Select
      value={value}
      onValueChange={(id) => router.replace(`${pathname}?sprint=${id}` as Route, { scroll: false })}
    >
      <SelectTrigger size="sm" className="w-48" aria-label="Sprint">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {sprints.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.name}
            {s.state === "active" ? " (active)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
